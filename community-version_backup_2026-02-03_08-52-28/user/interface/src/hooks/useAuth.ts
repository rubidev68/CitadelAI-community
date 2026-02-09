import { useState, useEffect } from 'react';
import { getChatbots, setDefaultChatbot, getChatbot } from '../lib/api';

interface Block {
  id: string;
  type: string;
  subtype: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: Record<string, any>;
}

interface Connection {
  id: string;
  fromBlockId: string;
  toBlockId: string;
}

interface Chatbot {
  id: string;
  name: string;
  blocks: Block[];
  connections: Connection[];
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [currentChatbot, setCurrentChatbot] = useState<Chatbot | null>(null);
  const [defaultChatbotId, setDefaultChatbotId] = useState<string | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const testToken = urlParams.get('test_token');

      if (testToken) {
        localStorage.setItem('citadel-token', testToken);
        // Clean the URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const storedToken = localStorage.getItem('citadel-token');

      if (storedToken) {
        setToken(storedToken);
        try {
          const chatbotIdMatch = window.location.pathname.match(/chatbot\/([^/]+)/);
          if (testToken && chatbotIdMatch) {
            const chatbotId = chatbotIdMatch[1];
            const chatbot = await getChatbot(chatbotId);
            setChatbots([chatbot]);
            setCurrentChatbot(chatbot);
          } else {
            const { chatbots, defaultChatbotId } = await getChatbots();
            setChatbots(chatbots);
            setDefaultChatbotId(defaultChatbotId);
            if (defaultChatbotId) {
              setCurrentChatbot(chatbots.find((c: Chatbot) => c.id === defaultChatbotId) || null);
            } else if (chatbots.length > 0) {
              setCurrentChatbot(chatbots[0]);
            }
          }
          setAuthStatus('authenticated');
        } catch (error) {
          console.error(error);
          logout();
        }
      } else {
        setAuthStatus('unauthenticated');
      }
    };

    initializeAuth();
  }, []);

  const login = async (newToken: string) => {
    setToken(newToken);
    localStorage.setItem('citadel-token', newToken);
    setAuthStatus('loading');
    try {
      const { chatbots, defaultChatbotId } = await getChatbots();
      setChatbots(chatbots);
      setDefaultChatbotId(defaultChatbotId);
      if (defaultChatbotId) {
        setCurrentChatbot(chatbots.find((c: Chatbot) => c.id === defaultChatbotId) || null);
      } else if (chatbots.length > 0) {
        setCurrentChatbot(chatbots[0]);
      }
      setAuthStatus('authenticated');
    } catch (error) {
      console.error(error);
      logout();
    }
  };

  const logout = () => {
    setToken(null);
    setChatbots([]);
    setCurrentChatbot(null);
    setDefaultChatbotId(null);
    localStorage.removeItem('citadel-token');
    setAuthStatus('unauthenticated');
  };

  const setCurrent = (chatbot: Chatbot) => {
    setCurrentChatbot(chatbot);
  };

  const setDefault = async (chatbotId: string) => {
    try {
      await setDefaultChatbot(chatbotId);
      setDefaultChatbotId(chatbotId);
    } catch (error) {
      console.error(error);
    }
  };

  return {
    token,
    authStatus,
    login,
    logout,
    isAuthenticated: authStatus === 'authenticated',
    chatbots,
    currentChatbot,
    setCurrent,
    setDefault,
    defaultChatbotId,
  };
}