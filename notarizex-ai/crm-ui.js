const columns = ['novo', 'agendado', 'executado', 'retorno_futuro'];
const labels = { novo: 'Entrou em contato', agendado: 'Agendado', executado: 'Executado', retorno_futuro: 'Retorno futuro' };

function getSession() {
  try { return JSON.parse(localStorage.getItem('sb_session') || '{}'); } catch (e) { return {}; }
}

function html(value) {
  return String(value || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

async function api(payload) {
  const session = getSession();
  const response = await fetch('/.netlify/functions/opportunities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, botId: session.botId, clientToken: session.clientToken })
  });
  return response.json();
}

async function moveLead(id, status) {
  await api({ action: 'update', leadId: id, status });
  loadBoard();
}

async function setReturn(id) {
  const date = prompt('Data de retorno. Ex: 2026-07-15 10:00');
  if (!date) return;
  await api({ action: 'update', leadId: id, status: 'retorno_futuro', returnAt: new Date(date).toISOString() });
  loadBoard();
}

function card(lead) {
  const contact = lead.phone || lead.email || lead.name || 'Contato não informado';
  return `<div class="bg-slate-900 border border-white/10 rounded-xl p-3 mb-2">
    <b>${html(contact)}</b>
    <p class="text-sm text-slate-300 mt-2">${html(lead.interest)}</p>
    <p class="text-xs text-green-400 mt-1">${html(lead.intent)} · ${html(lead.lead_temperature)}</p>
    <div class="grid grid-cols-2 gap-1 mt-3 text-xs">
      <button class="bg-white/10 rounded p-2" onclick="moveLead('${lead.id}','agendado')">Agendado</button>
      <button class="bg-white/10 rounded p-2" onclick="moveLead('${lead.id}','executado')">Executado</button>
      <button class="bg-white/10 rounded p-2" onclick="setReturn('${lead.id}')">Retorno</button>
      <button class="bg-white/10 rounded p-2" onclick="moveLead('${lead.id}','novo')">Novo</button>
    </div>
  </div>`;
}

async function loadBoard() {
  const board = document.getElementById('board');
  const session = getSession();
  if (!board) return;
  if (!session.botId || !session.clientToken) {
    board.innerHTML = '<div class="text-yellow-300">Entre pelo painel primeiro.</div>';
    return;
  }
  board.innerHTML = '<div class="text-slate-500">Carregando...</div>';
  const data = await api({ action: 'list' });
  const leads = data.leads || [];
  board.innerHTML = columns.map(status => {
    const items = leads.filter(item => (item.pipeline_status || 'novo') === status);
    return `<section><h2 class="font-black mb-3">${labels[status]} <span class="text-slate-500">${items.length}</span></h2>${items.map(card).join('') || '<div class="text-slate-600 text-sm">Vazio</div>'}</section>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', loadBoard);
