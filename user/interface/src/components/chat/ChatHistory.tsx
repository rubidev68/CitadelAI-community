import { MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { getChatSessions } from "@/lib/api";

interface ChatSession {
  id: string;
  title: string;
}

interface ChatHistoryProps {
  activeChatSession: string | null;
  setActiveChatSession: (id: string | null) => void;
  chatSessions: ChatSession[];
  setChatSessions: (sessions: ChatSession[]) => void;
  onNewChat: () => void;
  chatbotId?: string;
  primaryColor?: string | null;
}

export function ChatHistory({ activeChatSession, setActiveChatSession, chatSessions, setChatSessions, onNewChat, chatbotId, primaryColor }: ChatHistoryProps) {
  useEffect(() => {
    const fetchChatSessions = async () => {
      try {
        const sessions = await getChatSessions(chatbotId);
        setChatSessions(sessions);
      } catch (error) {
        console.error("Failed to fetch chat sessions:", error);
      }
    };

    fetchChatSessions();
  }, [setChatSessions, chatbotId]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 md:p-4 flex-shrink-0">
        <Button className="w-full justify-start gap-2 md:gap-3 text-sm md:text-base" onClick={onNewChat}>
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-citadel">
        <div className="p-3 md:p-4 space-y-2">
          {chatSessions.map((chat) => {
            const isActive = activeChatSession === chat.id;
            return (
              <Button
                key={chat.id}
                variant={isActive ? "ghost" : "ghost"}
                className="w-full justify-start gap-2 md:gap-3 text-sm md:text-base"
                onClick={() => setActiveChatSession(chat.id)}
                style={isActive && primaryColor ? {
                  backgroundColor: primaryColor,
                  color: '#ffffff',
                } : undefined}
              >
                <MessageSquare className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{chat.title}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}