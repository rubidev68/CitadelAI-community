// In-memory widget session store (per chatbot)
export const widgetSessionsByChatbot = new Map<string, Set<string>>();

// In-memory session storage for API token requests (use Redis in production)
export const apiSessions = new Map<string, { chatbotId: string; messages: Array<{ role: string; content: string }> }>();

// Clean up old sessions periodically
setInterval(() => {
  if (widgetSessionsByChatbot.size > 10000) {
    const entries = Array.from(widgetSessionsByChatbot.entries());
    entries.slice(0, 1000).forEach(([chatbotId]) => {
      widgetSessionsByChatbot.delete(chatbotId);
    });
  }
  if (apiSessions.size > 1000) {
    const firstKey = apiSessions.keys().next().value;
    if (firstKey) {
      apiSessions.delete(firstKey);
    }
  }
}, 60 * 60 * 1000); // Run every hour
