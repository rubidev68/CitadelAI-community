// In-memory session storage (use Redis in production)
export const apiSessions = new Map<string, { chatbotId: string; messages: Array<{ role: string; content: string }> }>();

/**
 * Get or create session
 */
export function getOrCreateSession(sessionId: string | undefined, chatbotId: string): { session: { chatbotId: string; messages: Array<{ role: string; content: string }> }; sessionId: string } {
  let session = sessionId ? apiSessions.get(sessionId) : null;
  let currentSessionId: string = sessionId || '';

  if (!session) {
    currentSessionId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    session = { chatbotId, messages: [] };
    apiSessions.set(currentSessionId, session);
    // Clean up old sessions (keep last 1000)
    if (apiSessions.size > 1000) {
      const firstKey = apiSessions.keys().next().value;
      if (firstKey) {
        apiSessions.delete(firstKey);
      }
    }
  } else if (sessionId) {
    currentSessionId = sessionId;
  }

  return { session, sessionId: currentSessionId };
}

/**
 * Get session ID from session object
 */
export function getSessionId(session: { chatbotId: string; messages: Array<{ role: string; content: string }> }): string | undefined {
  for (const [id, s] of apiSessions.entries()) {
    if (s === session) {
      return id;
    }
  }
  return undefined;
}
