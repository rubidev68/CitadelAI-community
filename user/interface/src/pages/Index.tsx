import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ChatbotList } from "@/components/chat/ChatbotList";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAuthContext } from "@/contexts/AuthContext.hooks";
import { Building, Menu, X } from "lucide-react";
import { createChatSession } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// Helper function to convert hex to HSL strings for base and glow colors
const hexToHsl = (hex: string): { base: string; glow: string; hover: string; l: number } | null => {
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
  }

  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  const lightness = Math.round(l * 100);

  // Calculate glow by increasing lightness, capped at 100%
  const glowL = Math.min(lightness + 20, 100);
  const hoverL = Math.max(lightness - 10, 0);

  return {
    base: `${h} ${s}% ${lightness}%`,
    glow: `${h} ${s}% ${glowL}%`,
    hover: `${h} ${s}% ${hoverL}%`,
    l: lightness,
  };
};

interface Block {
  subtype: string;
  properties: {
    theme?: string;
    accentColor?: string;
  };
}


interface ChatSession {
  id: string;
  title: string;
}

const Index = () => {
  const {
    authStatus,
    logout,
    chatbots,
    currentChatbot,
    setCurrent,
    setDefault,
    defaultChatbotId,
    
  } = useAuthContext();
  const navigate = useNavigate();
  const [activeChatSession, setActiveChatSession] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const updateChatSessionTitle = (sessionId: string, newTitle: string) => {
    setChatSessions(prevSessions =>
      prevSessions.map(session =>
        session.id === sessionId ? { ...session, title: newTitle } : session
      )
    );
  };

  const handleDeleteChatSession = (sessionId: string) => {
    setChatSessions(prevSessions => prevSessions.filter(session => session.id !== sessionId));
    setActiveChatSession(null);
  };

  const handleNewChat = async () => {
    try {
      const newSession = await createChatSession(currentChatbot?.id);
      setChatSessions(prevSessions => [newSession, ...prevSessions]);
      setActiveChatSession(newSession.id);
      // Close sidebar on mobile when creating new chat
      setIsSidebarOpen(false);
      return newSession;
    } catch (error) {
      console.error("Failed to create chat session:", error);
    }
  };

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      navigate("/login");
    }
  }, [authStatus, navigate]);

  useEffect(() => {
    if (currentChatbot) {
      const interfaceBlock = currentChatbot.blocks.find(
        (b: Block) => b.subtype === 'Interface'
      );

      if (interfaceBlock) {
        const { theme, accentColor } = interfaceBlock.properties;
        
        // Apply theme
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }

        // Apply accent color
        const hslColor = hexToHsl(accentColor);
        if (hslColor) {
          document.documentElement.style.setProperty('--primary', hslColor.base);
          document.documentElement.style.setProperty('--primary-glow', hslColor.glow);
          document.documentElement.style.setProperty('--primary-hover', hslColor.hover);

          // Set foreground color based on accent color lightness
          const primaryForeground = hslColor.l > 50 ? '240 15% 8%' : '0 0% 98%'; // dark on light, light on dark
          document.documentElement.style.setProperty('--primary-foreground', primaryForeground);
        }
      }
    }
  }, [currentChatbot]);

  if (authStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/20">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-primary mx-auto flex items-center justify-center shadow-lg">
            <Building className="h-8 w-8 text-primary-foreground animate-pulse" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Loading Platform...</h1>
          <p className="text-muted-foreground">Preparing your workspace</p>
        </div>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return null; // Will redirect to login
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      <Sidebar
        onLogout={logout}
        activeChatSession={activeChatSession}
        setActiveChatSession={(id) => {
          setActiveChatSession(id);
          // Close sidebar on mobile when selecting a chat
          setIsSidebarOpen(false);
        }}
        chatSessions={chatSessions}
        setChatSessions={setChatSessions}
        onNewChat={handleNewChat}
        chatbotId={currentChatbot?.id}
        chatbot={currentChatbot}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {currentChatbot ? (
          <>
            <div className="flex items-center justify-between p-3 md:p-4 border-b gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden flex-shrink-0"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <Select
                  value={currentChatbot.id}
                  onValueChange={(chatbotId) => {
                    const selected = chatbots.find((c) => c.id === chatbotId);
                    if (selected) {
                      setCurrent(selected);
                      // Clear active chat session when switching chatbots
                      setActiveChatSession(null);
                    }
                  }}
                >
                  <SelectTrigger className="w-full md:w-[280px]">
                    <SelectValue placeholder="Select a chatbot" />
                  </SelectTrigger>
                  <SelectContent>
                    {chatbots.map((chatbot) => {
                      const isSelected = chatbot.id === currentChatbot?.id;
                      return (
                        <SelectItem 
                          key={chatbot.id} 
                          value={chatbot.id}
                          className={isSelected ? "bg-primary/10" : ""}
                        >
                          {chatbot.name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              {currentChatbot.id !== defaultChatbotId && (
                <Button
                  onClick={() => setDefault(currentChatbot.id)}
                  className="hidden sm:inline-flex flex-shrink-0"
                >
                  Set as Default
                </Button>
              )}
            </div>
            <div className="flex-1 min-h-0">
              <ChatInterface
                className="flex-1"
                chatbot={currentChatbot}
                chatSessionId={activeChatSession}
                updateChatSessionTitle={updateChatSessionTitle}
                onDeleteChatSession={handleDeleteChatSession}
                onNewChat={handleNewChat}
              />
            </div>
          </>
        ) : (
          <ChatbotList onSelectChatbot={setCurrent} />
        )}
      </main>
    </div>
  );
};

export default Index;
