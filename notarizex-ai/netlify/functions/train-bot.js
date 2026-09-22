const fetch = require('node-fetch');
const pdfParse = require('pdf-parse');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST'
};

function reply(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function clean(value) {
  return String(value || '').trim();
}

function normalizeText(value, max = 180000) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, max);
}

function decodeFile(base64) {
  try {
    const buffer = Buffer.from(String(base64 || ''), 'base64');
    return buffer.length ? buffer : null;
  } catch (_) {
    return null;
  }
}

async function supabase(path, options = {}) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY } = process.env;
  const key = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !key) throw new Error('Supabase não configurado.');

  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {})
    }
  });
}

async function rows(res, label) {
  if (!res.ok) throw new Error(`${label}: ${(await res.text()).slice(0, 700)}`);
  const raw = await res.text();
  return raw ? JSON.parse(raw) : [];
}

async function getBot(botId, clientToken) {
  const res = await supabase(`website_bots?bot_id=eq.${encodeURIComponent(botId)}&client_token=eq.${encodeURIComponent(clientToken)}&select=bot_id,company_name,client_token&limit=1`);
  const data = await rows(res, 'Verificar autenticação do bot');
  return data[0] || null;
}

async function extractText(buffer, ext) {
  if (ext === '.pdf') {
    const parsed = await pdfParse(buffer);
    return normalizeText(parsed && parsed.text);
  }
  if (ext === '.txt' || ext === '.md') {
    return normalizeText(buffer.toString('utf8'));
  }
  throw new Error('Tipo de arquivo ainda não processável. Use PDF, TXT ou MD.');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { success: false, error: 'Method Not Allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const action = clean(body.action);
    const botId = clean(body.botId);
    const clientToken = clean(body.clientToken);
    const fileName = clean(body.fileName);
    const fileData = body.fileData;
    const fileId = clean(body.fileId);

    if (!botId || !clientToken) {
      return reply(400, { success: false, error: 'botId e clientToken são obrigatórios.' });
    }

    const bot = await getBot(botId, clientToken);
    if (!bot) {
      return reply(403, { success: false, error: 'Token inválido ou bot não encontrado.' });
    }

    if (action === 'list_files') {
      const filesRes = await supabase(`bot_training_files?bot_id=eq.${encodeURIComponent(botId)}&order=created_at.desc`);
      const files = await rows(filesRes, 'Listar documentos');
      return reply(200, { success: true, files });
    }

    if (action === 'upload_file') {
      if (!fileData || !fileName) {
        return reply(400, { success: false, error: 'Escolha um arquivo para enviar.' });
      }

      const ext = fileName.includes('.') ? fileName.toLowerCase().slice(fileName.lastIndexOf('.')) : '';
      const allowedExtensions = ['.pdf', '.txt', '.md'];
      if (!allowedExtensions.includes(ext)) {
        return reply(400, {
          success: false,
          error: 'Nesta versão, o treinamento real aceita PDF, TXT e MD. DOCX será habilitado em uma próxima etapa.'
        });
      }

      const buffer = decodeFile(fileData);
      if (!buffer) {
        return reply(400, { success: false, error: 'Não consegui ler o arquivo. Tente enviar novamente.' });
      }
      if (buffer.length > 5 * 1024 * 1024) {
        return reply(400, { success: false, error: 'Arquivo muito grande para treinamento direto. Máximo desta etapa: 5MB.' });
      }

      const extracted = await extractText(buffer, ext);
      if (extracted.length < 20) {
        return reply(400, { success: false, error: 'O arquivo não contém texto suficiente para treinar o bot.' });
      }

      const localFileId = `knowledge-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
      const insertFileRes = await supabase('bot_training_files', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          bot_id: botId,
          openai_file_id: localFileId,
          file_name: fileName,
          file_size_bytes: buffer.length,
          status: 'active',
          created_at: new Date().toISOString()
        })
      });
      const fileRows = await rows(insertFileRes, 'Salvar documento');
      const savedFile = fileRows[0];
      if (!savedFile || !savedFile.id) throw new Error('Documento salvo sem identificador.');

      try {
        const knowledgeRes = await supabase('smartbot_knowledge', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            bot_id: botId,
            title: fileName,
            content: extracted,
            is_active: true,
            source_type: 'file',
            source_file_id: savedFile.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        });
        const knowledgeRows = await rows(knowledgeRes, 'Adicionar conteúdo à base do Brain');
        if (!knowledgeRows[0] || !knowledgeRows[0].id) throw new Error('Conhecimento salvo sem identificador.');
      } catch (knowledgeError) {
        await supabase(`bot_training_files?id=eq.${encodeURIComponent(savedFile.id)}&bot_id=eq.${encodeURIComponent(botId)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'failed' })
        }).catch(() => null);
        throw knowledgeError;
      }

      await supabase(`website_bots?bot_id=eq.${encodeURIComponent(botId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          uploaded_file_name: fileName,
          uploaded_file_size_bytes: buffer.length,
          knowledge_status: 'ok',
          updated_at: new Date().toISOString()
        })
      }).catch(() => null);

      return reply(200, {
        success: true,
        message: `Documento "${fileName}" processado. O conteúdo já faz parte do conhecimento deste SmartBot.`,
        fileId: savedFile.id,
        knowledgeChars: extracted.length,
        aiStatus: 'ready'
      });
    }

    if (action === 'remove_file') {
      if (!fileId) return reply(400, { success: false, error: 'fileId é obrigatório para remoção.' });

      const ownedRes = await supabase(`bot_training_files?id=eq.${encodeURIComponent(fileId)}&bot_id=eq.${encodeURIComponent(botId)}&select=id,status&limit=1`);
      const ownedRows = await rows(ownedRes, 'Validar documento');
      if (!ownedRows[0]) return reply(404, { success: false, error: 'Documento não encontrado para este SmartBot.' });

      const updateRes = await supabase(`bot_training_files?id=eq.${encodeURIComponent(fileId)}&bot_id=eq.${encodeURIComponent(botId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'removed' })
      });
      await rows(updateRes, 'Remover documento');

      const knowledgeRes = await supabase(`smartbot_knowledge?bot_id=eq.${encodeURIComponent(botId)}&source_file_id=eq.${encodeURIComponent(fileId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ is_active: false, updated_at: new Date().toISOString() })
      });
      await rows(knowledgeRes, 'Desativar conhecimento do documento');

      return reply(200, {
        success: true,
        message: 'Documento removido. O conteúdo associado deixou de ser usado pelo Brain.'
      });
    }

    return reply(400, { success: false, error: `Ação desconhecida: ${action}.` });
  } catch (error) {
    console.error('[TrainBot] Erro:', error.message);
    return reply(500, { success: false, error: error.message || 'Erro no treinamento do bot.' });
  }
};
