(function(){
  window.SmartBots = window.SmartBots || {};

  function makeId(){
    var id = localStorage.getItem('smartbots_visitor_id');
    if(!id){ id = 'visitor-' + Date.now() + '-' + Math.random().toString(16).slice(2); localStorage.setItem('smartbots_visitor_id', id); }
    return id;
  }

  window.SmartBots.init = function(config){
    config = config || {};
    var botId = config.botId;
    if(!botId){ console.warn('SmartBots: botId ausente'); return; }

    var color = config.primaryColor || '#00FF88';
    var greeting = config.greeting || 'Olá! Como posso ajudar?';
    var visitorId = makeId();

    var style = document.createElement('style');
    style.innerHTML = '.sb-btn{position:fixed;right:22px;bottom:22px;width:62px;height:62px;border-radius:999px;border:0;background:'+color+';color:#06120b;font-size:28px;z-index:999999;box-shadow:0 12px 35px rgba(0,0,0,.25);cursor:pointer}.sb-box{position:fixed;right:22px;bottom:96px;width:360px;max-width:calc(100vw - 30px);height:520px;max-height:calc(100vh - 130px);background:#0f1722;color:white;border:1px solid rgba(255,255,255,.12);border-radius:20px;z-index:999999;box-shadow:0 22px 80px rgba(0,0,0,.35);display:none;overflow:hidden;font-family:Inter,Arial,sans-serif}.sb-head{padding:16px;background:linear-gradient(135deg,#111827,#0b1220);border-bottom:1px solid rgba(255,255,255,.1);font-weight:800}.sb-body{height:372px;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px}.sb-msg{padding:10px 12px;border-radius:14px;line-height:1.35;font-size:14px;white-space:pre-wrap}.sb-bot{background:rgba(255,255,255,.08);align-self:flex-start}.sb-user{background:'+color+';color:#06120b;align-self:flex-end;font-weight:700}.sb-form{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(255,255,255,.1)}.sb-input{flex:1;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:12px;color:white;padding:11px;outline:none}.sb-send{background:'+color+';color:#06120b;border:0;border-radius:12px;padding:0 14px;font-weight:900;cursor:pointer}';
    document.head.appendChild(style);

    var btn = document.createElement('button');
    btn.className = 'sb-btn';
    btn.innerHTML = '💬';

    var box = document.createElement('div');
    box.className = 'sb-box';
    box.innerHTML = '<div class="sb-head">SmartBots IA</div><div class="sb-body"></div><form class="sb-form"><input class="sb-input" placeholder="Digite sua mensagem..."/><button class="sb-send">Enviar</button></form>';

    document.body.appendChild(btn);
    document.body.appendChild(box);

    var body = box.querySelector('.sb-body');
    var form = box.querySelector('form');
    var input = box.querySelector('input');

    function add(text, type){
      var el = document.createElement('div');
      el.className = 'sb-msg ' + (type === 'user' ? 'sb-user' : 'sb-bot');
      el.textContent = text;
      body.appendChild(el);
      body.scrollTop = body.scrollHeight;
    }

    btn.onclick = function(){
      box.style.display = box.style.display === 'block' ? 'none' : 'block';
      if(!box.dataset.started){ add(greeting, 'bot'); box.dataset.started = '1'; }
    };

    form.onsubmit = async function(e){
      e.preventDefault();
      var message = input.value.trim();
      if(!message) return;
      input.value = '';
      add(message, 'user');
      add('Pensando...', 'bot');
      var thinking = body.lastChild;
      try{
        var res = await fetch('https://smartbots.club/.netlify/functions/smartbot-chat', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ botId:botId, visitorId:visitorId, channel:'site', message:message }) });
        var data = await res.json();
        thinking.textContent = data.reply || data.error || 'Não consegui responder agora. A equipe vai retornar.';
      }catch(err){
        thinking.textContent = 'Não consegui responder agora. Deixe seu nome e WhatsApp para retorno.';
      }
    };
  };
})();
