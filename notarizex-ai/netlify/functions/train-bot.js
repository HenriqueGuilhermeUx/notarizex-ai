const fetch = require('node-fetch');

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

function decodeBase64Size(base64) {
  try {
    return Buffer.from(String(base64 || ''), 'base64').length;
  } catch (_) {
    return 0;
  }
}

async function supabase(path, options = {}) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase não configurado.');

  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...(options.headers || {})
    }
  });
}

async function getBot(botId, clientToken) {
  const res = await supabase(`website_bots?bot_id=eq.${encodeURIComponent(botId)}&client_token=eq.${encodeURIComponent(clientToken)}&select=*`);
  if (!res.ok) throw new Error('Falha ao verificar autenticação do bot.');
  const rows = await res.json();
  return rows && rows[0] ? rows[0] : null;
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
      const files = filesRes.ok ? await filesRes.json() : [];
      return reply(200, { success: true, files });
    }

    if (action === 'upload_file') {
      if (!fileData || !fileName) {
        return reply(400, { success: false, error: 'Escolha um arquivo para enviar.' });
      }

      const allowedExtensions = ['.pdf', '.txt', '.docx', '.md'];
      const ext = fileName.includes('.') ? fileName.toLowerCase().slice(fileName.lastIndexOf('.')) : '';
      if (!allowedExtensions.includes(ext)) {
        return reply(400, { success: false, error: `Tipo de arquivo não suportado. Use: ${allowedExtensions.join(', ')}` });
      }

      const fileSizeBytes = decodeBase64Size(fileData);
      if (!fileSizeBytes) {
        return reply(400, { success: false, error: 'Não consegui ler o arquivo. Tente enviar novamente.' });
      }
      if (fileSizeBytes > 20 * 1024 * 1024) {
        return reply(400, { success: false, error: 'Arquivo muito grande. Máximo: 20MB.' });
      }

      const localFileId = `local-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

      const insertRes = await supabase('bot_training_files', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          bot_id: botId,
          openai_file_id: localFileId,
          file_name: fileName,
          file_size_bytes: fileSizeBytes,
          status: 'active',
          created_at: new Date().toISOString()
        })
      });

      if (!insertRes.ok) {
        throw new Error('Falha ao salvar arquivo no Supabase: ' + await insertRes.text());
      }

      const existingKnowledge = clean(bot.knowledge_text || bot.business_description || '');
      const docNote = `\n\n---\n\nDocumento recebido no painel: ${fileName} (${fileSizeBytes} bytes). Status: aguardando processamento avançado de IA.`;
      await supabase(`website_bots?bot_id=eq.${encodeURIComponent(botId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          knowledge_text: (existingKnowledge + docNote).slice(0, 50000),
          uploaded_file_name: fileName,
          uploaded_file_size_bytes: fileSizeBytes,
          updated_at: new Date().toISOString()
        })
      }).catch(() => null);

      return reply(200, {
        success: true,
        message: `Documento "${fileName}" recebido com sucesso. Ele já ficou registrado na base do bot.`,
        fileId: localFileId,
        aiStatus: 'pending_advanced_training'
      });
    }

    if (action === 'remove_file') {
      if (!fileId) return reply(400, { success: false, error: 'fileId é obrigatório para remoção.' });

      const updateRes = await supabase(`bot_training_files?id=eq.${encodeURIComponent(fileId)}&bot_id=eq.${encodeURIComponent(botId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'removed' })
      });

      if (!updateRes.ok) throw new Error('Falha ao remover arquivo: ' + await updateRes.text());
      return reply(200, { success: true, message: 'Arquivo removido com sucesso.' });
    }

    return reply(400, { success: false, error: `Ação desconhecida: ${action}.` });
  } catch (error) {
    console.error('[TrainBot] Erro:', error.message);
    return reply(500, { success: false, error: error.message || 'Erro no treinamento do bot.' });
  }
};
