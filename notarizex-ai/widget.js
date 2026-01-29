/**
 * SmartBots Widget v1.0
 * Chatbot widget para integração em sites
 */

(function() {
  'use strict';
  
  window.SmartBots = {
    config: null,
    isOpen: false,
    messages: [],
    threadId: null,
    
    init: function(userConfig) {
      this.config = {
        botId: userConfig.botId || '',
        primaryColor: userConfig.primaryColor || '#00FF88',
        position: userConfig.position || 'bottom-right',
        greeting: userConfig.greeting || 'Olá! Como posso ajudar?',
        placeholder: userConfig.placeholder || 'Digite sua mensagem...',
        title: userConfig.title || 'Chat',
        apiUrl: 'https://smartbots.club/.netlify/functions/chat'
      };
      
      if (!this.config.botId) {
        console.error('[SmartBots] botId é obrigatório');
        return;
      }
      
      this.injectStyles();
      this.createWidget();
      this.attachEvents();
      
      // Mensagem de boas-vindas
      setTimeout(() => {
        this.addMessage(this.config.greeting, 'bot');
      }, 1000);
    },
    
    injectStyles: function() {
      const styles = `
        #smartbots-widget * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        #smartbots-widget {
          position: fixed;
          ${this.config.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
          ${this.config.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
        
        #smartbots-toggle {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: ${this.config.primaryColor};
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          transition: transform 0.2s, box-shadow 0.2s;
          color: #000;
        }
        
        #smartbots-toggle:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
        }
        
        #smartbots-toggle:active {
          transform: scale(0.95);
        }
        
        #smartbots-chat {
          display: none;
          width: 380px;
          max-width: calc(100vw - 40px);
          height: 600px;
          max-height: calc(100vh - 100px);
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          position: absolute;
          ${this.config.position.includes('bottom') ? 'bottom: 70px;' : 'top: 70px;'}
          ${this.config.position.includes('right') ? 'right: 0;' : 'left: 0;'}
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideUp 0.3s ease-out;
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        #smartbots-chat.open {
          display: flex;
        }
        
        #smartbots-header {
          background: ${this.config.primaryColor};
          color: #000;
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 600;
          font-size: 16px;
        }
        
        #smartbots-close {
          background: none;
          border: none;
          color: #000;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.2s;
        }
        
        #smartbots-close:hover {
          background: rgba(0, 0, 0, 0.1);
        }
        
        #smartbots-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: #f5f5f5;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .smartbots-message {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          animation: fadeIn 0.3s ease-out;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .smartbots-message.user {
          flex-direction: row-reverse;
        }
        
        .smartbots-message-content {
          max-width: 70%;
          padding: 12px 16px;
          border-radius: 18px;
          font-size: 14px;
          line-height: 1.4;
          word-wrap: break-word;
        }
        
        .smartbots-message.bot .smartbots-message-content {
          background: #ffffff;
          color: #000;
          border-bottom-left-radius: 4px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }
        
        .smartbots-message.user .smartbots-message-content {
          background: ${this.config.primaryColor};
          color: #000;
          border-bottom-right-radius: 4px;
        }
        
        .smartbots-typing {
          display: none;
          padding: 12px 16px;
          background: #ffffff;
          border-radius: 18px;
          border-bottom-left-radius: 4px;
          max-width: 70px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }
        
        .smartbots-typing.active {
          display: block;
        }
        
        .smartbots-typing-dots {
          display: flex;
          gap: 4px;
        }
        
        .smartbots-typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #999;
          animation: typing 1.4s infinite;
        }
        
        .smartbots-typing-dot:nth-child(2) {
          animation-delay: 0.2s;
        }
        
        .smartbots-typing-dot:nth-child(3) {
          animation-delay: 0.4s;
        }
        
        @keyframes typing {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.7;
          }
          30% {
            transform: translateY(-10px);
            opacity: 1;
          }
        }
        
        #smartbots-input-container {
          padding: 16px 20px;
          background: #ffffff;
          border-top: 1px solid #e0e0e0;
          display: flex;
          gap: 12px;
          align-items: center;
        }
        
        #smartbots-input {
          flex: 1;
          border: 1px solid #e0e0e0;
          border-radius: 24px;
          padding: 12px 16px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
          font-family: inherit;
        }
        
        #smartbots-input:focus {
          border-color: ${this.config.primaryColor};
        }
        
        #smartbots-send {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: ${this.config.primaryColor};
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
          color: #000;
          font-size: 18px;
          font-weight: bold;
        }
        
        #smartbots-send:hover {
          transform: scale(1.05);
        }
        
        #smartbots-send:active {
          transform: scale(0.95);
        }
        
        #smartbots-send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        @media (max-width: 480px) {
          #smartbots-chat {
            width: calc(100vw - 20px);
            height: calc(100vh - 80px);
            ${this.config.position.includes('right') ? 'right: 10px;' : 'left: 10px;'}
            ${this.config.position.includes('bottom') ? 'bottom: 70px;' : 'top: 70px;'}
          }
        }
      `;
      
      const styleSheet = document.createElement('style');
      styleSheet.textContent = styles;
      document.head.appendChild(styleSheet);
    },
    
    createWidget: function() {
      const widgetHTML = `
        <div id="smartbots-widget">
          <button id="smartbots-toggle" aria-label="Abrir chat">
            💬
          </button>
          <div id="smartbots-chat">
            <div id="smartbots-header">
              <span>${this.config.title}</span>
              <button id="smartbots-close" aria-label="Fechar chat">×</button>
            </div>
            <div id="smartbots-messages">
              <div class="smartbots-typing">
                <div class="smartbots-typing-dots">
                  <div class="smartbots-typing-dot"></div>
                  <div class="smartbots-typing-dot"></div>
                  <div class="smartbots-typing-dot"></div>
                </div>
              </div>
            </div>
            <div id="smartbots-input-container">
              <input 
                type="text" 
                id="smartbots-input" 
                placeholder="${this.config.placeholder}"
                aria-label="Digite sua mensagem"
              />
              <button id="smartbots-send" aria-label="Enviar mensagem">➤</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.insertAdjacentHTML('beforeend', widgetHTML);
    },
    
    attachEvents: function() {
      const toggle = document.getElementById('smartbots-toggle');
      const close = document.getElementById('smartbots-close');
      const input = document.getElementById('smartbots-input');
      const send = document.getElementById('smartbots-send');
      
      toggle.addEventListener('click', () => this.toggleChat());
      close.addEventListener('click', () => this.closeChat());
      send.addEventListener('click', () => this.sendMessage());
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.sendMessage();
      });
    },
    
    toggleChat: function() {
      const chat = document.getElementById('smartbots-chat');
      this.isOpen = !this.isOpen;
      
      if (this.isOpen) {
        chat.classList.add('open');
        document.getElementById('smartbots-input').focus();
      } else {
        chat.classList.remove('open');
      }
    },
    
    closeChat: function() {
      const chat = document.getElementById('smartbots-chat');
      chat.classList.remove('open');
      this.isOpen = false;
    },
    
    addMessage: function(text, sender) {
      const messagesContainer = document.getElementById('smartbots-messages');
      const messageHTML = `
        <div class="smartbots-message ${sender}">
          <div class="smartbots-message-content">${this.escapeHtml(text)}</div>
        </div>
      `;
      
      // Remove typing indicator
      const typing = messagesContainer.querySelector('.smartbots-typing');
      typing.classList.remove('active');
      
      messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
      this.messages.push({ text, sender, timestamp: new Date() });
    },
    
    showTyping: function() {
      const typing = document.querySelector('.smartbots-typing');
      typing.classList.add('active');
      const messagesContainer = document.getElementById('smartbots-messages');
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    },
    
    hideTyping: function() {
      const typing = document.querySelector('.smartbots-typing');
      typing.classList.remove('active');
    },
    
    sendMessage: async function() {
      const input = document.getElementById('smartbots-input');
      const send = document.getElementById('smartbots-send');
      const message = input.value.trim();
      
      if (!message) return;
      
      // Adicionar mensagem do usuário
      this.addMessage(message, 'user');
      input.value = '';
      send.disabled = true;
      
      // Mostrar typing
      this.showTyping();
      
      try {
        const response = await fetch(this.config.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            botId: this.config.botId,
            message: message,
            threadId: this.threadId
          })
        });
        
        if (!response.ok) {
          throw new Error('Erro ao enviar mensagem');
        }
        
        const data = await response.json();
        
        // Salvar threadId para manter contexto
        if (data.threadId) {
          this.threadId = data.threadId;
        }
        
        // Adicionar resposta do bot
        this.hideTyping();
        this.addMessage(data.reply, 'bot');
        
      } catch (error) {
        console.error('[SmartBots] Erro:', error);
        this.hideTyping();
        this.addMessage('Desculpe, ocorreu um erro. Tente novamente.', 'bot');
      } finally {
        send.disabled = false;
        input.focus();
      }
    },
    
    escapeHtml: function(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  };
})();
