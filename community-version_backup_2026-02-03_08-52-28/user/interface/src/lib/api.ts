
import { buildApiUrl, getAuthHeaders } from "../config/api";

export const getChatbots = async () => {
  const url = buildApiUrl("/api/chatbots");
  const headers = getAuthHeaders();

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to fetch chatbots");
  }

  return response.json();
};

export const setDefaultChatbot = async (chatbotId: string) => {
  const url = buildApiUrl(`/api/chatbots/${chatbotId}/set-default`);
  const headers = getAuthHeaders();

  const response = await fetch(url, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to set default chatbot");
  }

  return response.json();
};

export const getChatSessions = async (chatbotId?: string) => {
  const url = buildApiUrl(`/api/chat${chatbotId ? `?chatbotId=${chatbotId}` : ''}`);
  const headers = getAuthHeaders();

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to fetch chat sessions");
  }

  return response.json();
};

export const createChatSession = async (chatbotId?: string) => {
  const url = buildApiUrl("/api/chat");
  const headers = getAuthHeaders();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ chatbotId }),
  });

  if (!response.ok) {
    throw new Error("Failed to create chat session");
  }

  return response.json();
};

export const getMe = async () => {
  const url = buildApiUrl("/api/auth/me");
  const headers = getAuthHeaders();

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user profile");
  }

  return response.json();
};

export const getHistory = async (sessionId: string) => {
  const url = buildApiUrl(`/api/chat/history?sessionId=${sessionId}`);
  const headers = getAuthHeaders();

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to fetch chat history");
  }

  return response.json();
};

export const generateChatTitle = async (chatSessionId: string) => {
  const url = buildApiUrl(`/api/chat/${chatSessionId}/title`);
  const headers = getAuthHeaders();

  const response = await fetch(url, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to generate chat title");
  }

  return response.json();
};

export const deleteChatSession = async (chatSessionId: string) => {
  const url = buildApiUrl(`/api/chat/${chatSessionId}`);
  const headers = getAuthHeaders();

  const response = await fetch(url, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to delete chat session");
  }
};

export const getChatbot = async (chatbotId: string) => {
  const url = buildApiUrl(`/api/chatbots/${chatbotId}`);
  const headers = getAuthHeaders();

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to fetch chatbot");
  }

  return response.json();
};
