// Re-export from new modular structure for backward compatibility
export {
  respond,
  getHistory,
  getChatSessions,
  createChatSession,
  generateTitle,
  deleteChatSession,
  respondStreamingWidget,
  respondStreaming,
  respondApiToken,
  respondInternal,
  respondStreamingApiToken,
  respondStreamingSlack
} from './chat/index';
