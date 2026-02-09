// Widget script generator function
export function generateWidgetScript(chatbotId: string, properties: Record<string, any>, apiBaseUrl: string): string {
  const config = {
    chatbotId,
    bubbleColor: properties.bubbleColor || '#007bff',
    bubbleSize: properties.bubbleSize || 'medium',
    bubbleIcon: properties.bubbleIcon || '💬',
    position: properties.position || 'bottom-right',
    offsetX: properties.offsetX || 20,
    offsetY: properties.offsetY || 20,
    chatWindowTitle: properties.chatWindowTitle || 'Chat',
    chatWindowColor: properties.chatWindowColor || properties.bubbleColor || '#007bff',
    chatWindowTheme: properties.chatWindowTheme || 'light',
    greetingMessage: properties.greetingMessage || null,
    autoOpen: properties.autoOpen || false,
    showOnMobile: properties.showOnMobile !== false,
    apiBaseUrl
  };
  
  // Escape config for JavaScript
  const configJson = JSON.stringify(config).replace(/</g, '\\u003c').replace(/\//g, '\\/');
  
  // Generate the widget script
  const widgetScript = `(function() {
  'use strict';
  
  const config = ${configJson};
  const sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  let isChatOpen = false;
  let messageHistory = []; // Client-side message history
  
  function getPositionStyles() {
    const { position, offsetX, offsetY } = config;
    const positions = {
      'bottom-right': \`bottom: \${offsetY}px; right: \${offsetX}px;\`,
      'bottom-left': \`bottom: \${offsetY}px; left: \${offsetX}px;\`,
      'top-right': \`top: \${offsetY}px; right: \${offsetX}px;\`,
      'top-left': \`top: \${offsetY}px; left: \${offsetX}px;\`
    };
    return positions[position] || positions['bottom-right'];
  }
  
  function getModalPositionStyles() {
    const { position, offsetX, offsetY } = config;
    const bubbleSize = getBubbleSize();
    const bubbleHeight = parseInt(bubbleSize.height) || 56;
    const spacing = 16; // Space between bubble and modal
    
    // Calculate modal position based on bubble position
    const positions = {
      'bottom-right': \`bottom: \${offsetY + bubbleHeight + spacing}px; right: \${offsetX}px;\`,
      'bottom-left': \`bottom: \${offsetY + bubbleHeight + spacing}px; left: \${offsetX}px;\`,
      'top-right': \`top: \${offsetY + bubbleHeight + spacing}px; right: \${offsetX}px;\`,
      'top-left': \`top: \${offsetY + bubbleHeight + spacing}px; left: \${offsetX}px;\`
    };
    return positions[position] || positions['bottom-right'];
  }
  
  function isTopPosition() {
    return config.position === 'top-right' || config.position === 'top-left';
  }
  
  function getInitialTransform() {
    if (isTopPosition()) {
      return 'scale(0.95) translateY(-10px)';
    }
    return 'scale(0.95) translateY(10px)';
  }
  
  function getOpenTransform() {
    return 'scale(1) translateY(0)';
  }
  
  function getCloseTransform() {
    if (isTopPosition()) {
      return 'scale(0.95) translateY(-10px)';
    }
    return 'scale(0.95) translateY(10px)';
  }
  
  function isDarkTheme() {
    return config.chatWindowTheme === 'dark';
  }
  
  function getThemeColors() {
    if (isDarkTheme()) {
      return {
        windowBg: 'hsl(0, 0%, 12%)',
        messagesBg: 'hsl(0, 0%, 12%)',
        userMessageBg: config.chatWindowColor,
        userMessageText: 'hsl(30, 29%, 95%)',
        assistantMessageBg: 'hsl(0, 0%, 18%)',
        assistantMessageText: 'hsl(0, 0%, 90%)',
        assistantMessageBorder: 'hsl(0, 0%, 25%)',
        inputBg: 'hsl(0, 0%, 18%)',
        inputText: 'hsl(0, 0%, 90%)',
        inputBorder: 'hsl(0, 0%, 25%)',
        inputPlaceholder: 'hsl(0, 0%, 50%)',
        followUpsBg: 'hsl(0, 0%, 15%)',
        followUpsBorder: 'hsl(0, 0%, 25%)',
        sourcesBg: 'hsl(0, 0%, 18%)',
        sourcesText: 'hsl(0, 0%, 85%)',
        borderColor: 'hsl(0, 0%, 25%)',
        scrollbarTrack: 'hsl(0, 0%, 15%)',
        scrollbarThumb: 'hsl(0, 0%, 30%)'
      };
    } else {
      return {
        windowBg: 'hsl(0, 0%, 100%)',
        messagesBg: 'hsl(0, 0%, 100%)',
        userMessageBg: config.chatWindowColor,
        userMessageText: 'hsl(30, 29%, 95%)',
        assistantMessageBg: 'hsl(0, 0%, 100%)',
        assistantMessageText: 'hsl(173, 43%, 15%)',
        assistantMessageBorder: 'hsl(30, 20%, 88%)',
        inputBg: 'hsl(0, 0%, 100%)',
        inputText: 'hsl(173, 43%, 15%)',
        inputBorder: 'hsl(30, 20%, 88%)',
        inputPlaceholder: 'hsl(173, 20%, 50%)',
        followUpsBg: 'hsl(30, 20%, 90% / 0.3)',
        followUpsBorder: 'hsl(30, 20%, 88%)',
        sourcesBg: 'hsl(30, 20%, 90%)',
        sourcesText: 'hsl(173, 43%, 15%)',
        borderColor: 'hsl(30, 20%, 88%)',
        scrollbarTrack: 'hsl(0, 0%, 95%)',
        scrollbarThumb: 'hsl(0, 0%, 80%)'
      };
    }
  }
  
  function getBubbleSize() {
    const sizes = {
      'small': { width: '50px', height: '50px', iconSize: '20px' },
      'medium': { width: '56px', height: '56px', iconSize: '24px' },
      'large': { width: '70px', height: '70px', iconSize: '28px' }
    };
    return sizes[config.bubbleSize] || sizes['medium'];
  }
  
  function createBubble() {
    const size = getBubbleSize();
    const bubble = document.createElement('button');
    bubble.id = 'chatbot-bubble';
    bubble.type = 'button';
    bubble.setAttribute('aria-label', 'Open chat');
    
    // Convert hex to HSL for shadow
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };
    const rgb = hexToRgb(config.bubbleColor);
    const shadowColor = rgb ? \`hsl(\${rgb.r}, \${rgb.g}, \${rgb.b} / 0.15)\` : 'hsl(173 43% 31% / 0.15)';
    
    bubble.style.cssText = \`
      position: fixed;
      width: \${size.width};
      height: \${size.height};
      background-color: \${config.bubbleColor};
      border-radius: 9999px;
      cursor: pointer;
      box-shadow: 0 8px 32px \${shadowColor};
      z-index: 50;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border: none;
      padding: 0;
      opacity: 0;
      transform: scale(0);
      animation: bubbleFadeIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      \${getPositionStyles()}
    \`;
    
    // MessageCircle icon SVG
    const iconSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: hsl(30, 29%, 95%); pointer-events: none;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    bubble.innerHTML = iconSvg;
    
    bubble.addEventListener('mouseenter', () => {
      if (!isChatOpen) {
        bubble.style.transform = 'scale(1.1)';
      }
    });
    bubble.addEventListener('mouseleave', () => {
      if (!isChatOpen) {
        bubble.style.transform = 'scale(1)';
      }
    });
    bubble.addEventListener('click', () => {
      if (isChatOpen) {
        closeChat();
      } else {
        openChat();
      }
    });
    
    return bubble;
  }
  
  function createBackdrop() {
    const backdrop = document.createElement('div');
    backdrop.id = 'chatbot-backdrop';
    backdrop.style.cssText = \`
      position: fixed;
      inset: 0;
      z-index: 30;
      background: rgba(0, 0, 0, 0.1);
      display: none;
    \`;
    backdrop.addEventListener('click', closeChat);
    return backdrop;
  }
  
  function createChatWindow() {
    const wrapper = document.createElement('div');
    wrapper.id = 'chatbot-window-wrapper';
    wrapper.setAttribute('data-position', config.position);
    wrapper.style.cssText = \`
      position: fixed;
      \${getModalPositionStyles()}
      z-index: 40;
      display: none;
    \`;
    
    const themeColors = getThemeColors();
    const chatWindow = document.createElement('div');
    chatWindow.id = 'chatbot-window';
    chatWindow.style.cssText = \`
      background: \${themeColors.windowBg};
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      width: 400px;
      height: 600px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      transform: \${getInitialTransform()};
      transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    \`;
    
    const header = document.createElement('div');
    header.style.cssText = \`
      background-color: \${config.chatWindowColor};
      color: hsl(30, 29%, 95%);
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid \${config.chatWindowColor}33;
    \`;
    
    const titleWrapper = document.createElement('div');
    titleWrapper.style.cssText = 'display: flex; flex-direction: column; gap: 0;';
    
    const title = document.createElement('h2');
    title.textContent = config.chatWindowTitle || 'AI Assistant';
    title.style.cssText = 'font-weight: 600; font-size: 18px; line-height: 1.2; margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;';
    titleWrapper.appendChild(title);
    
    const poweredBy = document.createElement('a');
    poweredBy.href = 'https://citadelai.app';
    poweredBy.target = '_blank';
    poweredBy.rel = 'noopener noreferrer';
    poweredBy.textContent = 'Powered by CitadelAI';
    poweredBy.style.cssText = 'font-size: 12px; opacity: 0.9; text-decoration: none; transition: opacity 0.2s; line-height: 1.2; color: hsl(30, 29%, 95%); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;';
    poweredBy.addEventListener('mouseenter', () => {
      poweredBy.style.opacity = '1';
      poweredBy.style.textDecoration = 'underline';
    });
    poweredBy.addEventListener('mouseleave', () => {
      poweredBy.style.opacity = '0.9';
      poweredBy.style.textDecoration = 'none';
    });
    titleWrapper.appendChild(poweredBy);
    
    header.appendChild(titleWrapper);
    
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: hsl(30, 29%, 95%);"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    closeBtn.style.cssText = \`
      background: transparent;
      border: none;
      color: hsl(30, 29%, 95%);
      width: 40px;
      height: 40px;
      border-radius: 0.375rem;
      cursor: pointer;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      flex-shrink: 0;
    \`;
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'transparent';
    });
    closeBtn.addEventListener('click', closeChat);
    header.appendChild(closeBtn);
    
    chatWindow.appendChild(header);
    
    const messagesContainer = document.createElement('div');
    messagesContainer.id = 'chatbot-messages';
    messagesContainer.style.cssText = \`
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      scroll-behavior: smooth;
      background: \${themeColors.messagesBg};
    \`;
    
    // Add scrollbar styling for dark theme
    if (isDarkTheme()) {
      messagesContainer.style.cssText += \`
        scrollbar-width: thin;
        scrollbar-color: \${themeColors.scrollbarThumb} \${themeColors.scrollbarTrack};
      \`;
    }
    chatWindow.appendChild(messagesContainer);
    
    const followUpsContainer = document.createElement('div');
    followUpsContainer.id = 'chatbot-followups';
    followUpsContainer.style.cssText = \`
      padding: 12px 16px;
      border-top: 1px solid \${themeColors.followUpsBorder};
      display: none;
      background: \${themeColors.followUpsBg};
    \`;
    chatWindow.appendChild(followUpsContainer);
    
    const inputArea = document.createElement('div');
    inputArea.style.cssText = \`
      padding: 16px;
      border-top: 1px solid \${themeColors.borderColor};
      display: flex;
      gap: 8px;
      align-items: flex-end;
      background: \${themeColors.windowBg};
    \`;
    
    const input = document.createElement('textarea');
    input.placeholder = 'Type your message...';
    input.rows = 1;
    input.style.cssText = \`
      flex: 1;
      min-height: 44px;
      max-height: 120px;
      width: 100%;
      padding: 8px 12px;
      border: 1px solid \${themeColors.inputBorder};
      border-radius: calc(0.75rem - 2px);
      font-size: 14px;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      resize: none;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      overflow-y: auto;
      background: \${themeColors.inputBg};
      color: \${themeColors.inputText};
    \`;
    input.addEventListener('focus', () => {
      input.style.outline = 'none';
      input.style.boxShadow = \`0 0 0 2px \${config.chatWindowColor}40\`;
    });
    input.addEventListener('blur', () => {
      input.style.boxShadow = 'none';
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input.value);
      }
    });
    
    const sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
    sendBtn.style.cssText = \`
      background-color: \${config.chatWindowColor};
      color: hsl(30, 29%, 95%);
      height: 44px;
      padding: 0 16px;
      border: none;
      border-radius: calc(0.75rem - 2px);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      flex-shrink: 0;
    \`;
    sendBtn.addEventListener('mouseenter', () => {
      sendBtn.style.opacity = '0.9';
    });
    sendBtn.addEventListener('mouseleave', () => {
      sendBtn.style.opacity = '1';
    });
    sendBtn.addEventListener('click', () => sendMessage(input.value));
    
    inputArea.appendChild(input);
    inputArea.appendChild(sendBtn);
    chatWindow.appendChild(inputArea);
    
    wrapper.appendChild(chatWindow);
    return wrapper;
  }
  
  function openChat() {
    const wrapper = document.getElementById('chatbot-window-wrapper');
    const chatWindow = document.getElementById('chatbot-window');
    const backdrop = document.getElementById('chatbot-backdrop');
    const bubble = document.getElementById('chatbot-bubble');
    
    isChatOpen = true;
    
    if (backdrop) {
      backdrop.style.display = 'block';
    }
    
    if (wrapper && chatWindow) {
      wrapper.style.display = 'block';
      setTimeout(() => {
        chatWindow.style.opacity = '1';
        chatWindow.style.transform = getOpenTransform();
      }, 10);
      
      if (config.greetingMessage) {
        setTimeout(() => {
          addMessage(config.greetingMessage, 'bot');
        }, 300);
      }
    }
    
    if (bubble) {
      bubble.style.transform = 'rotate(90deg)';
      bubble.setAttribute('aria-label', 'Close chat');
      // Change icon to X
      bubble.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: hsl(30, 29%, 95%); pointer-events: none;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    }
  }
  
  function closeChat() {
    const wrapper = document.getElementById('chatbot-window-wrapper');
    const chatWindow = document.getElementById('chatbot-window');
    const backdrop = document.getElementById('chatbot-backdrop');
    const bubble = document.getElementById('chatbot-bubble');
    
    isChatOpen = false;
    
    if (chatWindow) {
      chatWindow.style.opacity = '0';
      chatWindow.style.transform = getCloseTransform();
      setTimeout(() => {
        if (wrapper) wrapper.style.display = 'none';
        if (backdrop) backdrop.style.display = 'none';
      }, 300);
    }
    
    if (bubble) {
      bubble.style.transform = 'rotate(0deg)';
      bubble.setAttribute('aria-label', 'Open chat');
      // Change icon back to MessageCircle
      bubble.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: hsl(30, 29%, 95%); pointer-events: none;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    }
  }
  
  let currentAssistantMessageDiv = null;
  let isStreaming = false;
  
  function addMessage(text, sender, messageId) {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (!messagesContainer) return null;
    
    const messageIndex = messagesContainer.children.length;
    const messageWrapper = document.createElement('div');
    messageWrapper.style.cssText = \`
      display: flex;
      justify-content: \${sender === 'user' ? 'flex-end' : 'flex-start'};
      animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      animation-delay: \${messageIndex * 0.1}s;
      animation-fill-mode: both;
    \`;
    
    const messageDiv = document.createElement('div');
    messageDiv.id = messageId || \`message-\${Date.now()}\`;
    messageDiv.style.cssText = \`
      max-width: 80%;
      border-radius: 16px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      \${(() => {
        const themeColors = getThemeColors();
        if (sender === 'user') {
          return \`background: \${themeColors.userMessageBg}; color: \${themeColors.userMessageText};\`;
        } else {
          return \`background: \${themeColors.assistantMessageBg}; color: \${themeColors.assistantMessageText}; border: 1px solid \${themeColors.assistantMessageBorder};\`;
        }
      })()}
    \`;
    
    const contentP = document.createElement('p');
    contentP.style.cssText = \`
      font-size: 14px;
      line-height: 1.6;
      margin: 0;
      word-wrap: break-word;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    \`;
    
    if (sender === 'bot') {
      messageDiv.innerHTML = '<div class="message-content"></div>';
      updateMessageContent(messageDiv, text);
    } else {
      contentP.textContent = text;
      messageDiv.appendChild(contentP);
    }
    
    messageWrapper.appendChild(messageDiv);
    messagesContainer.appendChild(messageWrapper);
    
    // Smooth scroll to bottom
    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 50);
    
    return messageDiv;
  }
  
  function updateMessageContent(messageDiv, text) {
    const contentDiv = messageDiv.querySelector('.message-content');
    if (contentDiv) {
      // Use String.fromCharCode to avoid backtick issues in template literal
      const backtick = String.fromCharCode(96);
      const codeBlockPattern = new RegExp(backtick + backtick + backtick + '([\\\\s\\\\S]*?)' + backtick + backtick + backtick, 'g');
      const inlineCodePattern = new RegExp(backtick + '([^' + backtick + ']+)' + backtick, 'g');
      const themeColors = getThemeColors();
      const codeBlockBg = isDarkTheme() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
      const inlineCodeBg = isDarkTheme() ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)';
      const codeBlockReplacement = '<pre style="background: ' + codeBlockBg + '; padding: 10px; border-radius: 6px; overflow-x: auto; margin: 8px 0; font-size: 13px; font-family: \\\"Monaco\\\", \\\"Courier New\\\", monospace; color: inherit;"><code>$1</code></pre>';
      const inlineCodeReplacement = '<code style="background: ' + inlineCodeBg + '; padding: 2px 6px; border-radius: 4px; font-size: 13px; font-family: \\\"Monaco\\\", \\\"Courier New\\\", monospace;">$1</code>';
      
      let html = text
        // Headers
        .replace(/^### (.*$)/gim, '<h3 style="font-size: 16px; font-weight: 600; margin: 12px 0 8px 0; color: inherit;">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 style="font-size: 18px; font-weight: 600; margin: 14px 0 10px 0; color: inherit;">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 style="font-size: 20px; font-weight: 600; margin: 16px 0 12px 0; color: inherit;">$1</h1>')
        // Code blocks
        .replace(codeBlockPattern, codeBlockReplacement)
        // Inline code
        .replace(inlineCodePattern, inlineCodeReplacement)
        // Bold
        .replace(/\\*\\*(.*?)\\*\\*/g, '<strong style="font-weight: 600;">$1</strong>')
        // Italic
        .replace(/\\*(.*?)\\*/g, '<em style="font-style: italic;">$1</em>')
        // Links
        .replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: ' + config.chatWindowColor + '; text-decoration: underline; text-underline-offset: 2px;">$1</a>')
        // Lists
        .replace(/^\\* (.+)$/gim, '<li style="margin: 4px 0; padding-left: 4px;">$1</li>')
        .replace(/^\\d+\\. (.+)$/gim, '<li style="margin: 4px 0; padding-left: 4px; list-style-type: decimal;">$1</li>')
        // Line breaks
        .replace(/\\n/g, '<br>');
      
      // Wrap lists in ul/ol tags
      html = html.replace(/(<li[^>]*>.*?<\\/li>)/g, '<ul style="margin: 8px 0; padding-left: 20px;">$1</ul>');
      
      contentDiv.innerHTML = html;
      contentDiv.style.cssText = 'line-height: 1.6; word-break: break-word;';
    }
  }
  
  function addSources(citations, messageDiv) {
    if (!citations) return;
    
    // Handle array of source objects
    if (Array.isArray(citations) && citations.length === 0) return;
    if (typeof citations === 'string' && citations.trim() === '') return;
    
    const messageId = messageDiv.id;
    let expandedSources = JSON.parse(sessionStorage.getItem('expandedSources') || '[]');
    const isExpanded = expandedSources.includes(messageId);
    
    const sourcesContainer = document.createElement('div');
    sourcesContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
    
    const sourcesToggle = document.createElement('button');
    sourcesToggle.type = 'button';
    sourcesToggle.style.cssText = \`
      height: auto;
      padding: 4px 8px;
      font-size: 12px;
      background: transparent;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: \${isDarkTheme() ? 'hsl(0, 0%, 65%)' : 'hsl(173, 20%, 45%)'};
      transition: color 0.2s;
      align-self: flex-start;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    \`;
    
    const sourcesList = document.createElement('div');
    sourcesList.style.cssText = \`
      display: \${isExpanded ? 'flex' : 'none'};
      flex-direction: column;
      gap: 4px;
    \`;
    
    // Helper function to detect and convert URLs to clickable links
    function makeUrlsClickable(text) {
      // URL regex pattern (matches http://, https://, www., etc.)
      const urlPattern = /(https?:\\/\\/[^\\s]+|www\\.[^\\s]+|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\\.[a-zA-Z]{2,}[^\\s]*)/gi;
      return text.replace(urlPattern, (url) => {
        // Ensure URL has protocol
        let href = url;
        if (!url.match(/^https?:\\/\\//)) {
          href = url.startsWith('www.') ? 'https://' + url : 'https://' + url;
        }
        return '<a href="' + href + '" target="_blank" rel="noopener noreferrer" style="color: ' + config.chatWindowColor + '; text-decoration: underline; text-underline-offset: 2px;">' + url + '</a>';
      });
    }
    
    // Handle array of source objects
    if (Array.isArray(citations)) {
      const themeColors = getThemeColors();
      citations.forEach((source, index) => {
        const sourceItem = document.createElement('div');
        sourceItem.style.cssText = \`
          font-size: 12px;
          border-radius: 8px;
          padding: 8px 12px;
          background: \${themeColors.sourcesBg};
          color: \${themeColors.sourcesText};
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        \`;
        
        if (source.url) {
          // Create clickable link for URL sources
          const link = document.createElement('a');
          link.href = source.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = source.title || source.url;
          link.style.cssText = 'color: ' + config.chatWindowColor + '; text-decoration: underline; text-underline-offset: 2px; cursor: pointer;';
          sourceItem.appendChild(link);
        } else {
          // Display as text with clickable URLs if present
          const displayText = source.title || source.fileName || 'Source ' + (index + 1);
          sourceItem.innerHTML = makeUrlsClickable(displayText);
        }
        
        sourcesList.appendChild(sourceItem);
      });
    } else {
      // Handle string citations (markdown format)
      const citationsStr = typeof citations === 'string' ? citations : '';
      // Remove markdown header if present
      const cleanedCitations = citationsStr.replace(/^\\*\\*Sources:\\*\\*\\s*\\n?/i, '').trim();
      
      // Parse markdown links [text](url)
      const citationMatches = cleanedCitations.match(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g) || [];
      
      // Also try to parse numbered list format: "1. [text](url)"
      const numberedMatches = cleanedCitations.match(/\\d+\\.\\s*\\[([^\\]]+)\\]\\(([^)]+)\\)/g) || [];
      
      const allMatches = citationMatches.length > 0 ? citationMatches : numberedMatches;
      
      if (allMatches.length > 0) {
        const themeColors = getThemeColors();
        allMatches.forEach((match) => {
          const linkMatch = match.match(/\\[([^\\]]+)\\]\\(([^)]+)\\)/);
          if (linkMatch) {
            const sourceItem = document.createElement('div');
            sourceItem.style.cssText = \`
              font-size: 12px;
              border-radius: 8px;
              padding: 8px 12px;
              background: \${themeColors.sourcesBg};
              color: \${themeColors.sourcesText};
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            \`;
            // Create clickable link
            const link = document.createElement('a');
            link.href = linkMatch[2];
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = linkMatch[1];
            link.style.cssText = 'color: ' + config.chatWindowColor + '; text-decoration: underline; text-underline-offset: 2px; cursor: pointer;';
            sourceItem.appendChild(link);
            sourcesList.appendChild(sourceItem);
          }
        });
      } else if (cleanedCitations) {
        // Fallback: display as text with clickable URLs
        const themeColors = getThemeColors();
        const sourceItem = document.createElement('div');
        sourceItem.style.cssText = \`
          font-size: 12px;
          border-radius: 8px;
          padding: 8px 12px;
          background: \${themeColors.sourcesBg};
          color: \${themeColors.sourcesText};
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        \`;
        // Convert plain URLs to clickable links
        sourceItem.innerHTML = makeUrlsClickable(cleanedCitations);
        sourcesList.appendChild(sourceItem);
      } else {
        // No sources to display
        return;
      }
    }
    
    const updateToggle = () => {
      const isCurrentlyExpanded = expandedSources.includes(messageId);
      sourcesToggle.innerHTML = isCurrentlyExpanded
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>Hide sources'
        : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>Show sources';
      sourcesList.style.display = isCurrentlyExpanded ? 'flex' : 'none';
    };
    
    sourcesToggle.addEventListener('click', () => {
      if (expandedSources.includes(messageId)) {
        expandedSources = expandedSources.filter(id => id !== messageId);
      } else {
        expandedSources.push(messageId);
      }
      sessionStorage.setItem('expandedSources', JSON.stringify(expandedSources));
      updateToggle();
    });
    
    updateToggle();
    
    sourcesContainer.appendChild(sourcesToggle);
    sourcesContainer.appendChild(sourcesList);
    messageDiv.appendChild(sourcesContainer);
  }
  
  function showFollowUps(suggestions) {
    const followUpsContainer = document.getElementById('chatbot-followups');
    if (!followUpsContainer || !suggestions || suggestions.length === 0) return;
    
    followUpsContainer.innerHTML = '';
    
    const badgesContainer = document.createElement('div');
    badgesContainer.style.cssText = \`
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    \`;
    
    const themeColors = getThemeColors();
    suggestions.forEach((suggestion) => {
      const badge = document.createElement('button');
      badge.type = 'button';
      badge.textContent = suggestion.text;
      badge.style.cssText = \`
        font-size: 12px;
        height: 36px;
        border-radius: calc(0.75rem - 2px);
        padding: 0 12px;
        border: 1px solid \${themeColors.borderColor};
        background: \${themeColors.assistantMessageBg};
        color: \${themeColors.assistantMessageText};
        cursor: pointer;
        transition: all 0.2s;
      \`;
      badge.addEventListener('mouseenter', () => {
        badge.style.background = config.chatWindowColor;
        badge.style.color = 'hsl(30, 29%, 95%)';
        badge.style.borderColor = config.chatWindowColor;
      });
      badge.addEventListener('mouseleave', () => {
        badge.style.background = themeColors.assistantMessageBg;
        badge.style.color = themeColors.assistantMessageText;
        badge.style.borderColor = themeColors.borderColor;
      });
      badge.addEventListener('click', () => {
        sendMessage(suggestion.text);
      });
      badgesContainer.appendChild(badge);
    });
    
    followUpsContainer.appendChild(badgesContainer);
    followUpsContainer.style.display = 'block';
  }
  
  function hideFollowUps() {
    const followUpsContainer = document.getElementById('chatbot-followups');
    if (followUpsContainer) {
      followUpsContainer.style.display = 'none';
      followUpsContainer.innerHTML = '';
    }
  }
  
  async function sendMessage(message) {
    if (!message || !message.trim() || isStreaming) return;
    
    const input = document.querySelector('#chatbot-window textarea');
    if (input) {
      input.value = '';
      input.style.height = 'auto';
    }
    
    hideFollowUps();
    
    addMessage(message, 'user');
    
    const assistantMessageId = \`assistant-\${Date.now()}\`;
    currentAssistantMessageDiv = addMessage('...', 'bot', assistantMessageId);
    isStreaming = true;
    
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.style.cssText = \`
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 0;
    \`;
    typingIndicator.innerHTML = \`
      <span style="display: inline-block; width: 8px; height: 8px; background: currentColor; border-radius: 50%; animation: typingDot 1.4s infinite;"></span>
      <span style="display: inline-block; width: 8px; height: 8px; background: currentColor; border-radius: 50%; animation: typingDot 1.4s infinite 0.2s;"></span>
      <span style="display: inline-block; width: 8px; height: 8px; background: currentColor; border-radius: 50%; animation: typingDot 1.4s infinite 0.4s;"></span>
    \`;
    if (currentAssistantMessageDiv) {
      const contentDiv = currentAssistantMessageDiv.querySelector('.message-content');
      if (contentDiv) {
        contentDiv.innerHTML = '';
        contentDiv.appendChild(typingIndicator);
      }
    }
    
    // Styles are already added in init, but check again to be safe
    if (!document.getElementById('chatbot-styles')) {
      const style = document.createElement('style');
      style.id = 'chatbot-styles';
      style.textContent = \`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        @keyframes typingDot {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.7;
          }
          30% {
            transform: translateY(-8px);
            opacity: 1;
          }
        }
        @keyframes bubbleFadeIn {
          0% {
            opacity: 0;
            transform: scale(0);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes scaleIn {
          0% {
            transform: scale(0.95) translateY(10px);
            opacity: 0;
          }
          100% {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }
        @keyframes scaleOut {
          0% {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
          100% {
            transform: scale(0.95) translateY(10px);
            opacity: 0;
          }
        }
      \`;
      document.head.appendChild(style);
    }
    
    // Ensure we always use HTTPS (fallback if apiBaseUrl was set to HTTP)
    const apiUrl = config.apiBaseUrl.replace(/^http:/, 'https:');
    
    // Add user message to history
    messageHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });
    
    try {
      const response = await fetch(\`\${apiUrl}/api/chat/respond-streaming-widget\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          chatbotId: config.chatbotId,
          sessionId: sessionId, // Include sessionId for session tracking and limiting
          history: messageHistory.slice(0, -1) // Send history without current message
        })
      });
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      let citations = '';
      let followUps = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          // Skip empty lines (SSE separators)
          if (!line.trim()) continue;
          
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;
              
              const data = JSON.parse(jsonStr);
              
              switch (data.type) {
                case 'chunk':
                  const typingEl = currentAssistantMessageDiv?.querySelector('.typing-indicator');
                  if (typingEl) typingEl.remove();
                  
                  if (data.content) {
                    fullResponse += data.content;
                    if (currentAssistantMessageDiv) {
                      updateMessageContent(currentAssistantMessageDiv, fullResponse);
                      const messagesContainer = document.getElementById('chatbot-messages');
                      if (messagesContainer) {
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                      }
                    }
                  }
                  break;
                  
                case 'sources':
                  citations = data.citations || '';
                  break;
                  
                case 'followups':
                  followUps = data.suggestions || [];
                  // Show follow-ups immediately when received
                  if (followUps && followUps.length > 0) {
                    showFollowUps(followUps);
                  }
                  break;
                  
                case 'complete':
                  const typingEl2 = currentAssistantMessageDiv?.querySelector('.typing-indicator');
                  if (typingEl2) typingEl2.remove();
                  
                  if (currentAssistantMessageDiv) {
                    updateMessageContent(currentAssistantMessageDiv, data.fullResponse || fullResponse);
                    
                    // Save assistant message to history
                    messageHistory.push({
                      role: 'assistant',
                      content: data.fullResponse || fullResponse,
                      timestamp: new Date().toISOString()
                    });
                    
                    if (data.sources || citations) {
                      addSources(data.sources || citations, currentAssistantMessageDiv);
                    }
                    
                    // Use followUps from complete event or from followups event
                    const finalFollowUps = (data.followUps && data.followUps.length > 0) ? data.followUps : followUps;
                    if (finalFollowUps && finalFollowUps.length > 0) {
                      showFollowUps(finalFollowUps);
                    }
                  }
                  isStreaming = false;
                  break;
                  
                case 'error':
                  if (currentAssistantMessageDiv) {
                    updateMessageContent(currentAssistantMessageDiv, data.error || 'Sorry, an error occurred.');
                  }
                  isStreaming = false;
                  break;
              }
            } catch (e) {
              widgetRoutesLogger.error('Error parsing SSE data', { error: e instanceof Error ? e : new Error(String(e)), line });
            }
          }
        }
      }
      
    } catch (error) {
      widgetRoutesLogger.error('Error sending message', { error: error instanceof Error ? error : new Error(String(error)) });
      if (currentAssistantMessageDiv) {
        updateMessageContent(currentAssistantMessageDiv, 'Sorry, there was an error. Please try again.');
      }
      isStreaming = false;
    }
  }
  
  // Add styles early so animations work
  if (!document.getElementById('chatbot-styles')) {
    const style = document.createElement('style');
    style.id = 'chatbot-styles';
    style.textContent = \`
      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }
      @keyframes bubbleFadeIn {
        from {
          opacity: 0;
          transform: scale(0);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes scaleIn {
        0% {
          transform: scale(0.95) translateY(10px);
          opacity: 0;
        }
        100% {
          transform: scale(1) translateY(0);
          opacity: 1;
        }
      }
      @keyframes scaleInTop {
        0% {
          transform: scale(0.95) translateY(-10px);
          opacity: 0;
        }
        100% {
          transform: scale(1) translateY(0);
          opacity: 1;
        }
      }
      @keyframes scaleOut {
        0% {
          transform: scale(1) translateY(0);
          opacity: 1;
        }
        100% {
          transform: scale(0.95) translateY(10px);
          opacity: 0;
        }
      }
      @keyframes scaleOutTop {
        0% {
          transform: scale(1) translateY(0);
          opacity: 1;
        }
        100% {
          transform: scale(0.95) translateY(-10px);
          opacity: 0;
        }
      }
      #chatbot-window textarea::placeholder {
        color: \${isDarkTheme() ? 'hsl(0, 0%, 50%)' : 'hsl(173, 20%, 50%)'};
      }
      #chatbot-window textarea::-webkit-input-placeholder {
        color: \${isDarkTheme() ? 'hsl(0, 0%, 50%)' : 'hsl(173, 20%, 50%)'};
      }
      #chatbot-window textarea::-moz-placeholder {
        color: \${isDarkTheme() ? 'hsl(0, 0%, 50%)' : 'hsl(173, 20%, 50%)'};
      }
      #chatbot-window textarea:-ms-input-placeholder {
        color: \${isDarkTheme() ? 'hsl(0, 0%, 50%)' : 'hsl(173, 20%, 50%)'};
      }
      @media (max-width: 768px) {
        #chatbot-window {
          width: calc(100vw - 32px) !important;
          max-width: 400px !important;
          height: calc(100vh - 120px) !important;
          max-height: 600px !important;
        }
        #chatbot-window-wrapper[data-position*="top"] {
          top: 80px !important;
        }
        #chatbot-window-wrapper[data-position*="bottom"] {
          bottom: 80px !important;
        }
      }
    \`;
    document.head.appendChild(style);
  }
  
  function init() {
    if (!config.showOnMobile && window.innerWidth < 768) {
      return;
    }
    
    const bubble = createBubble();
    const backdrop = createBackdrop();
    const chatWindow = createChatWindow();
    
    document.body.appendChild(bubble);
    document.body.appendChild(backdrop);
    document.body.appendChild(chatWindow);
    
    if (config.autoOpen) {
      setTimeout(openChat, 1000);
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();`;
  
  return widgetScript;
}
