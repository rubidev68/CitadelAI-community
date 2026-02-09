import {
  Building,
  LogOut,
  User,
  X
} from "lucide-react";
import { Button } from "../ui/button";
import { ChatHistory } from "../chat/ChatHistory";
import { useEffect, useState, useMemo } from "react";
import { getMe } from "@/lib/api";

interface UserProfile {
  name: string;
  email: string;
}

interface ChatSession {
  id: string;
  title: string;
}

interface Block {
  id: string;
  type: string;
  subtype: string;
  properties: Record<string, unknown>;
}

interface Chatbot {
  id: string;
  name: string;
  blocks: Block[];
}

interface SidebarProps {
  onLogout: () => void;
  className?: string;
  activeChatSession: string | null;
  setActiveChatSession: (id: string | null) => void;
  chatSessions: ChatSession[];
  setChatSessions: (sessions: ChatSession[]) => void;
  onNewChat: () => void;
  chatbotId?: string;
  chatbot?: Chatbot;
  isOpen?: boolean;
  onClose?: () => void;
}

// Helper function to convert hex color to RGB
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  if (!hex || hex.length < 4) return null;

  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  } else {
    return null;
  }

  return { r, g, b };
};

export function Sidebar({ onLogout, className, activeChatSession, setActiveChatSession, chatSessions, setChatSessions, onNewChat, chatbotId, chatbot, isOpen = true, onClose }: SidebarProps) {
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getMe();
        setUser(userData);
      } catch (error) {
        console.error("Failed to fetch user profile:", error);
      }
    };

    fetchUser();
  }, []);

  // Extract primary color from chatbot
  const primaryColor = useMemo(() => {
    if (!chatbot) return null;
    const interfaceBlock = chatbot.blocks.find(
      (b: Block) => b.subtype === 'Interface'
    );
    if (interfaceBlock) {
      return (interfaceBlock.properties.primaryColor as string) || 
             (interfaceBlock.properties.accentColor as string) || 
             null;
    }
    return null;
  }, [chatbot]);

  return (
    <div 
      className={`
        fixed md:static inset-y-0 left-0 z-50
        w-80 border-r bg-sidebar flex flex-col h-full
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
        ${className}
      `}
    >
      {/* Platform Header */}
      <div className="p-4 mb-6 flex-shrink-0">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Building className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-sidebar-foreground">Platform</h1>
              <p className="text-sm text-sidebar-foreground/80">Main Interface</p>
            </div>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ChatHistory
          activeChatSession={activeChatSession}
          setActiveChatSession={setActiveChatSession}
          chatSessions={chatSessions}
          setChatSessions={setChatSessions}
          onNewChat={onNewChat}
          chatbotId={chatbotId}
          primaryColor={primaryColor}
        />
      </div>

      {/* Footer Actions */}
      <div className="p-4 space-y-2 pt-4 border-t flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div 
            className={`h-10 w-10 rounded-full flex items-center justify-center ${!primaryColor ? 'bg-secondary' : ''}`}
            style={primaryColor ? {
              backgroundColor: primaryColor,
              color: '#ffffff',
            } : undefined}
          >
            <User 
              className={`h-5 w-5 ${!primaryColor ? 'text-secondary-foreground' : ''}`}
              style={primaryColor ? { color: '#ffffff' } : undefined}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground">{user?.name || "Loading..."}</p>
            <p className="text-xs text-sidebar-foreground/80 truncate">{user?.email || "Loading..."}</p>
          </div>
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}