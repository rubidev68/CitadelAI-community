import { useState, useRef, useEffect, useMemo, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot, User, Sparkles, MessageSquare, Building, Trash, HelpCircle, Lightbulb, Search, Loader2 } from "lucide-react";
import { API_CONFIG, buildApiUrl, getAuthHeaders } from "@/config/api";
import { getHistory, generateChatTitle, deleteChatSession } from "@/lib/api";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { OAuthPrompt } from "./OAuthPrompt";
import { CalendarActionConfirmation } from "./CalendarActionConfirmation";
import { logger } from "@/lib/logger";

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  citations?: string;
}

interface FollowUpSuggestion {
  id: string;
  text: string;
  icon?: string;
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

interface HistoryMessage {
  id: string;
  content: string;
  role: string;
  createdAt: string;
}

interface ChatInterfaceProps {
  className?: string;
  chatbot: Chatbot;
  chatSessionId?: string;
  updateChatSessionTitle: (sessionId: string, title: string) => void;
  onDeleteChatSession: (sessionId: string) => void;
  onNewChat: () => Promise<{ id: string; title: string } | null>;
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

function ChatInterfaceComponent({ className, chatbot, chatSessionId, updateChatSessionTitle, onDeleteChatSession, onNewChat }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [followUps, setFollowUps] = useState<FollowUpSuggestion[]>([]);
  const [currentCitations, setCurrentCitations] = useState<string>("");
  const [authRequirements, setAuthRequirements] = useState<Array<{
    provider: string;
    authUrl?: string;
    blockId: string;
    serverUrl?: string;
    retryCount?: number;
  }>>([]);
  const [authModalOpen, setAuthModalOpen] = useState<{ [blockId: string]: boolean }>({});
  const [responseOnHold, setResponseOnHold] = useState(false);
  const [pendingCalendarAction, setPendingCalendarAction] = useState<{
    confirmationToken: string;
    action: 'create' | 'update' | 'delete';
    eventDetails: {
      summary?: string;
      start?: string;
      end?: string;
      location?: string;
      attendees?: string[];
    };
  } | null>(null);
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Detect if we're in Slack/API context
  // For now, we'll detect based on user agent or query params
  // In production, this could be determined by checking if request came from Slack/API endpoint
  const isSlackOrAPI = false; // Default to false for web interface
  // TODO: Detect Slack/API context from request metadata if available

  // ... (useMemo and useEffect for fetchHistory remain the same)
  const interfaceConfig = useMemo(() => {
    const interfaceBlock = chatbot.blocks.find(
      (b: Block) => b.subtype === 'Interface'
    );
    if (interfaceBlock) {
      // Check for primaryColor first, then fall back to accentColor
      const primaryColor = (interfaceBlock.properties.primaryColor as string) || 
                          (interfaceBlock.properties.accentColor as string) || 
                          '#000000';
      const primaryRgb = hexToRgb(primaryColor);
      const primaryColorRgba = primaryRgb 
        ? `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.08)`
        : `${primaryColor}15`;
      
      return {
        title: interfaceBlock.properties.title || chatbot.name,
        description: interfaceBlock.properties.description || "Your intelligent project companion",
        theme: interfaceBlock.properties.theme || 'light',
        accentColor: interfaceBlock.properties.accentColor || '#000000',
        primaryColor: primaryColor,
        primaryColorRgba: primaryColorRgba,
        primaryRgb: primaryRgb,
      };
    }
    return {
      title: chatbot.name,
      description: "Your intelligent project companion",
      theme: 'light',
      accentColor: '#000000',
      primaryColor: '#000000',
      primaryColorRgba: 'rgba(0, 0, 0, 0.08)',
      primaryRgb: { r: 0, g: 0, b: 0 },
    };
  }, [chatbot]);

  // Extract and convert question suggestions from block properties
  const configuredSuggestions = useMemo(() => {
    const interfaceBlock = chatbot.blocks.find(
      (b: Block) => b.subtype === 'Interface'
    );
    
    if (interfaceBlock?.properties?.questionSuggestions) {
      const iconMap: { [key: string]: React.ReactNode } = {
        'Building': <Building className="h-4 w-4" />,
        'Sparkles': <Sparkles className="h-4 w-4" />,
        'MessageSquare': <MessageSquare className="h-4 w-4" />,
        'HelpCircle': <HelpCircle className="h-4 w-4" />,
        'Lightbulb': <Lightbulb className="h-4 w-4" />,
        'Search': <Search className="h-4 w-4" />,
      };

      return (interfaceBlock.properties.questionSuggestions as Array<{id: string, text: string, icon: string}>).map((suggestion) => ({
        id: suggestion.id,
        text: suggestion.text,
        icon: iconMap[suggestion.icon] || <MessageSquare className="h-4 w-4" />
      }));
    }
    
    // Fallback to default suggestions if none configured
    return [
      { id: '1', text: "Tell me about the platform", icon: <Building className="h-4 w-4" /> },
      { id: '2', text: "How do I create a new project?", icon: <Sparkles className="h-4 w-4" /> },
      { id: '3', text: "Explain the workflow", icon: <MessageSquare className="h-4 w-4" /> },
    ];
  }, [chatbot]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (chatSessionId) {
        try {
          const history = await getHistory(chatSessionId);
          if (history.length > 0) {
            setMessages(history.map((msg: HistoryMessage) => ({
              id: msg.id,
              content: msg.content,
              role: msg.role.toLowerCase() as 'user' | 'assistant',
              timestamp: new Date(msg.createdAt),
            })));
          } else {
            setMessages([]);
          }
        } catch (error) {
          logger.error("Failed to fetch chat history:", error);
          setMessages([]);
        }
      } else {
        setMessages([
          {
            id: '1',
            content: interfaceConfig.description,
            role: 'assistant',
            timestamp: new Date(),
          }
        ]);
      }
    };
    fetchHistory();
  }, [chatSessionId, interfaceConfig.description]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Memoized sendMessage function to prevent unnecessary re-renders
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    let currentChatSessionId = chatSessionId;
    const isNewChat = !currentChatSessionId;

    if (isNewChat) {
      const newSession = await onNewChat();
      if (!newSession) {
        toast({
          title: "Error",
          description: "Could not create a new chat session.",
          variant: "destructive",
        });
        return;
      }
      currentChatSessionId = newSession.id;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setIsLoadingSources(false); // Clear sources loading state
    setFollowUps([]); // Clear previous follow-ups
    setCurrentCitations(""); // Clear previous citations

    try {
      // Get user's timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CHAT.RESPOND_STREAMING), {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'X-User-Timezone': userTimezone, // Send user's timezone to backend
        },
        body: JSON.stringify({ message: content, chatSessionId: currentChatSessionId }),
      });

      if (!response.ok) {
        throw new Error('Streaming endpoint failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';
      let fullResponse = '';
      let assistantMessageAdded = false;
      let assistantMessageId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              logger.log('📡 Received streaming data:', data.type, data);
              
              switch (data.type) {
                case 'metadata':
                  if (data.chatSessionId && isNewChat) {
                    generateChatTitle(data.chatSessionId).then(updatedSession => {
                      updateChatSessionTitle(data.chatSessionId, updatedSession.title);
                    });
                  }
                  // Handle authentication requirements
                  if (data.requiresAuth) {
                    setAuthRequirements(prev => {
                      const existing = prev.find(a => a.blockId === data.authBlockId);
                      if (!existing) {
                        return [...prev, {
                          provider: data.authProvider || 'google_calendar',
                          authUrl: data.authUrl,
                          blockId: data.authBlockId || '',
                          serverUrl: data.serverUrl,
                        }];
                      }
                      return prev;
                    });
                  }
                  break;
                  
                case 'chunk':
                  if (!assistantMessageAdded) {
                    // Add assistant message on first chunk
                    assistantMessageId = Date.now().toString();
                    const assistantMessage: Message = {
                      id: assistantMessageId,
                      content: data.content,
                      role: 'assistant',
                      timestamp: new Date(),
                    };
                    setMessages(prev => [...prev, assistantMessage]);
                    assistantMessageAdded = true;
                    fullResponse = data.content;
                  } else {
                    // Update existing assistant message by ID
                    fullResponse += data.content;
                    if (assistantMessageId) {
                      setMessages(prev => prev.map(msg => 
                        msg.id === assistantMessageId
                          ? { ...msg, content: fullResponse }
                          : msg
                      ));
                    }
                  }
                  break;
                  
                case 'complete':
                  fullResponse = data.fullResponse || fullResponse;
                  if (!assistantMessageAdded) {
                    // Add assistant message if no chunks were received
                    assistantMessageId = Date.now().toString();
                    const assistantMessage: Message = {
                      id: assistantMessageId,
                      content: fullResponse,
                      role: 'assistant',
                      timestamp: new Date(),
                      citations: data.sources || "", // Include sources from complete event
                    };
                    setMessages(prev => [...prev, assistantMessage]);
                  } else {
                    // Update existing assistant message by ID
                    if (assistantMessageId) {
                      setMessages(prev => prev.map(msg => 
                        msg.id === assistantMessageId
                          ? { ...msg, content: fullResponse, citations: data.sources || msg.citations || "" }
                          : msg
                      ));
                    }
                  }
                  setIsLoading(false);
                  // If sources are included in complete event, stop loading sources
                  if (data.sources) {
                    setIsLoadingSources(false);
                  } else {
                    setIsLoadingSources(true); // Start loading sources if not included
                  }
                  // Handle follow-ups from complete event if present
                  if (data.followUps) {
                    const formattedFollowUps: FollowUpSuggestion[] = data.followUps.map((item: string | FollowUpSuggestion, index: number) => {
                      if (typeof item === 'string') {
                        return {
                          id: `followup-${index}`,
                          text: item,
                          icon: 'MessageSquare'
                        };
                      } else {
                        return {
                          id: item.id || `followup-${index}`,
                          text: item.text || '',
                          icon: item.icon || 'MessageSquare'
                        };
                      }
                    });
                    setFollowUps(formattedFollowUps);
                  }
                  break;
                  
                case 'citations': {
                  setIsLoadingSources(false); // Stop loading sources when citations are received
                  // Add citations to the current assistant message by ID
                  const citationsText = data.citations || "";
                  if (assistantMessageId) {
                    setMessages(prev => prev.map(msg => 
                      msg.id === assistantMessageId
                        ? { ...msg, citations: citationsText }
                        : msg
                    ));
                  } else {
                    // Fallback: update the most recent assistant message if no ID tracked
                    setMessages(prev => {
                      const lastAssistantIndex = prev.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i >= 0).pop();
                      if (lastAssistantIndex !== undefined && !prev[lastAssistantIndex].citations) {
                        const updated = [...prev];
                        updated[lastAssistantIndex] = { ...updated[lastAssistantIndex], citations: citationsText };
                        return updated;
                      }
                      return prev;
                    });
                  }
                  setCurrentCitations(""); // Clear currentCitations to avoid duplication
                  break;
                }
                  
                case 'followUps': {
                  // Handle both string[] (legacy) and FollowUpSuggestion[] formats
                  const followUpsData = data.followUps || [];
                  const formattedFollowUps: FollowUpSuggestion[] = followUpsData.map((item: string | FollowUpSuggestion, index: number) => {
                    if (typeof item === 'string') {
                      // Legacy format: string array
                      return {
                        id: `followup-${index}`,
                        text: item,
                        icon: 'MessageSquare'
                      };
                    } else {
                      // New format: FollowUpSuggestion object
                      return {
                        id: item.id || `followup-${index}`,
                        text: item.text || '',
                        icon: item.icon || 'MessageSquare'
                      };
                    }
                  });
                  setFollowUps(formattedFollowUps);
                  break;
                }
                  
                case 'calendar_confirmation':
                  // Handle calendar action confirmation request
                  if (data.pendingAction) {
                    setPendingCalendarAction({
                      confirmationToken: data.pendingAction.confirmationToken,
                      action: data.pendingAction.action,
                      eventDetails: data.pendingAction.eventDetails || {},
                    });
                  }
                  break;
                  
                case 'error':
                  throw new Error(data.error || 'Unknown streaming error');
                  
                case 'auth_required':
                  // Handle authentication requirement from backend - hold response
                  setResponseOnHold(true);
                  if (data.authProvider && data.authBlockId) {
                    setAuthRequirements(prev => {
                      const existing = prev.find(a => a.blockId === data.authBlockId);
                      if (!existing) {
                        return [...prev, {
                          provider: data.authProvider || 'google_calendar',
                          authUrl: data.authUrl,
                          blockId: data.authBlockId,
                          serverUrl: data.serverUrl,
                          retryCount: data.retryCount || 0,
                        }];
                      }
                      return prev;
                    });
                    // Open modal for this auth requirement
                    setAuthModalOpen(prev => ({
                      ...prev,
                      [data.authBlockId]: true,
                    }));
                  }
                  break;
                  
                case 'auth_completed':
                  // Auth completed - release hold and continue
                  setResponseOnHold(false);
                  // Close modals
                  setAuthModalOpen({});
                  break;
                  
                case 'auth_timeout':
                  // Auth timeout - release hold and continue without calendar
                  setResponseOnHold(false);
                  toast({
                    title: 'Authentication Timeout',
                    description: 'Authentication timeout reached. Continuing without calendar context.',
                    variant: 'default',
                  });
                  // Close modals
                  setAuthModalOpen({});
                  break;
              }
            } catch (parseError) {
              // Ignore parsing errors
            }
          }
        }
      }
      
    } catch (error) {
      // Fallback to regular endpoint
      try {
        const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CHAT.RESPOND), {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ message: content, chatSessionId: currentChatSessionId }),
        });

        if (!response.ok) {
          throw new Error('Failed to get response');
        }

        const { message: responseMessage, followUps: responseFollowUps, citations: responseCitations } = await response.json();

        if (isNewChat && currentChatSessionId) {
          generateChatTitle(currentChatSessionId).then(updatedSession => {
            updateChatSessionTitle(currentChatSessionId!, updatedSession.title);
          });
        }

        // Add assistant message with full response
        const assistantMessage: Message = {
          id: Date.now().toString(),
          content: responseMessage,
          role: 'assistant',
          timestamp: new Date(),
          citations: responseCitations,
        };
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoadingSources(false); // Sources are already included in regular response
        
        // Set follow-ups if provided
        // Handle both string[] (legacy) and FollowUpSuggestion[] formats
        if (responseFollowUps) {
          const formattedFollowUps: FollowUpSuggestion[] = responseFollowUps.map((item: string | FollowUpSuggestion, index: number) => {
            if (typeof item === 'string') {
              // Legacy format: string array
              return {
                id: `followup-${index}`,
                text: item,
                icon: 'MessageSquare'
              };
            } else {
              // New format: FollowUpSuggestion object
              return {
                id: item.id || `followup-${index}`,
                text: item.text || '',
                icon: item.icon || 'MessageSquare'
              };
            }
          });
          setFollowUps(formattedFollowUps);
        }
      } catch (fallbackError) {
        const errorMessage: Message = {
          id: Date.now().toString(),
          content: "I'm sorry, I encountered an error while responding. Please try again.",
          role: 'assistant',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsLoadingSources(false); // Stop loading sources on error
        
        toast({
          title: "Error",
          description: "Failed to get a response from the assistant.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [chatSessionId, onNewChat, updateChatSessionTitle, toast]);

  const handleDelete = useCallback(async () => {
    if (!chatSessionId) return;

    try {
      await deleteChatSession(chatSessionId);
      onDeleteChatSession(chatSessionId);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete the conversation.",
        variant: "destructive",
      });
    }
  }, [chatSessionId, onDeleteChatSession, toast]);

  const handleSuggestionClick = useCallback((suggestion: FollowUpSuggestion) => {
    sendMessage(suggestion.text);
  }, [sendMessage]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };


  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Chat Header */}
      <div className="border-b p-3 md:p-4 bg-primary text-primary-foreground flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Building className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base md:text-lg font-semibold truncate">{interfaceConfig.title}</h2>
              <p className="text-xs md:text-sm text-primary-foreground/80 truncate hidden sm:block">{interfaceConfig.description}</p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="icon"
            className="flex-shrink-0"
            onClick={handleDelete}
            disabled={!chatSessionId}
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 scrollbar-citadel">
        <div className="p-3 md:p-4 space-y-3 md:space-y-4">
          {/* Show OAuth modals if authentication is required */}
          {authRequirements.map((authReq) => (
            <OAuthPrompt
              key={`auth-${authReq.blockId}`}
              provider={authReq.provider as 'google_calendar' | 'caldav'}
              chatbotId={chatbot.id}
              blockId={authReq.blockId}
              authUrl={authReq.authUrl}
              serverUrl={authReq.serverUrl}
              isSlackOrAPI={isSlackOrAPI}
              open={authModalOpen[authReq.blockId] || false}
              onOpenChange={(open) => {
                setAuthModalOpen(prev => ({
                  ...prev,
                  [authReq.blockId]: open,
                }));
                if (!open) {
                  // Remove auth requirement when modal closes (unless auth was successful)
                  setTimeout(() => {
                    setAuthRequirements(prev => prev.filter(a => a.blockId !== authReq.blockId));
                  }, 500);
                }
              }}
              onAuthenticated={() => {
                // Remove this auth requirement after successful authentication
                setAuthRequirements(prev => prev.filter(a => a.blockId !== authReq.blockId));
                setAuthModalOpen(prev => {
                  const newState = { ...prev };
                  delete newState[authReq.blockId];
                  return newState;
                });
                setResponseOnHold(false);
              }}
            />
          ))}
          
          {/* Calendar Action Confirmation */}
          {pendingCalendarAction && (
            <CalendarActionConfirmation
              isOpen={!!pendingCalendarAction}
              action={pendingCalendarAction.action}
              eventDetails={pendingCalendarAction.eventDetails}
              confirmationToken={pendingCalendarAction.confirmationToken}
              isConfirming={isConfirmingAction}
              onConfirm={async () => {
                setIsConfirmingAction(true);
                try {
                  const response = await fetch(buildApiUrl('/api/calendar-actions/confirm'), {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                      confirmationToken: pendingCalendarAction.confirmationToken,
                    }),
                  });
                  
                  const result = await response.json();
                  
                  // Determine confirmation message
                  const actionType = pendingCalendarAction.action;
                  let confirmationMessage = '';
                  
                  if (result.success) {
                    if (actionType === 'create') {
                      confirmationMessage = '✅ Calendar event created successfully!';
                    } else if (actionType === 'update') {
                      confirmationMessage = '✅ Calendar event updated successfully!';
                    } else if (actionType === 'delete') {
                      confirmationMessage = '✅ Calendar event deleted successfully!';
                    }
                  } else {
                    confirmationMessage = `❌ Failed to ${actionType} calendar event: ${result.error || 'Unknown error'}`;
                  }
                  
                  // Add confirmation message to chat (don't trigger another AI call)
                  const confirmationMsg: Message = {
                    id: `confirmation-${Date.now()}`,
                    content: confirmationMessage,
                    role: 'assistant',
                    timestamp: new Date(),
                  };
                  setMessages(prev => [...prev, confirmationMsg]);
                  
                  // Clear pending action
                  setPendingCalendarAction(null);
                  
                  // Show toast as well
                  if (result.success) {
                    toast({
                      title: "Success",
                      description: confirmationMessage,
                    });
                  } else {
                    toast({
                      title: "Error",
                      description: result.error || 'Failed to execute calendar action',
                      variant: "destructive",
                    });
                  }
                } catch (error: unknown) {
                  const errorMessage = error instanceof Error ? error.message : 'Failed to confirm calendar action';
                  
                  // Add error message to chat
                  const errorMsg: Message = {
                    id: `error-${Date.now()}`,
                    content: `❌ ${errorMessage}`,
                    role: 'assistant',
                    timestamp: new Date(),
                  };
                  setMessages(prev => [...prev, errorMsg]);
                  
                  toast({
                    title: "Error",
                    description: errorMessage,
                    variant: "destructive",
                  });
                } finally {
                  setIsConfirmingAction(false);
                }
              }}
              onCancel={async () => {
                try {
                  // Cancel the pending action
                  await fetch(buildApiUrl('/api/calendar-actions/cancel'), {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                      confirmationToken: pendingCalendarAction.confirmationToken,
                    }),
                  });
                } catch (error) {
                  // Ignore cancel errors
                }
                setPendingCalendarAction(null);
              }}
            />
          )}
          
          {/* Show loading indicator when response is on hold */}
          {responseOnHold && (
            <div className="my-4 p-4 border border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Waiting for authentication to continue response...</span>
              </div>
            </div>
          )}
          
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2 md:gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary-foreground" />
                </div>
              )}
              
              <Card className={`max-w-[85%] sm:max-w-[80%] ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card shadow-sm'}`}>
                <CardContent className="p-2.5 md:p-3">
                  {message.role === 'assistant' ? (
                    <div className="text-xs md:text-sm">
                      <MarkdownRenderer content={message.content || '...'} />
                      {isLoading && message.content && (
                        <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1"></span>
                      )}
                      {isLoadingSources && (
                        <div className="mt-2 md:mt-3 pt-2 md:pt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-2 text-xs md:text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex space-x-1">
                              <div className="w-1 h-1 bg-current rounded-full animate-pulse"></div>
                              <div className="w-1 h-1 bg-current rounded-full animate-pulse delay-75"></div>
                              <div className="w-1 h-1 bg-current rounded-full animate-pulse delay-150"></div>
                            </div>
                            <span>Loading sources...</span>
                          </div>
                        </div>
                      )}
                      {(message.citations || currentCitations) && !isLoadingSources && (
                        <div className="mt-2 md:mt-3 pt-2 md:pt-3 border-t border-gray-200 dark:border-gray-700">
                          <MarkdownRenderer content={message.citations || currentCitations} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs md:text-sm whitespace-pre-wrap">
                      {message.content}
                    </p>
                  )}
                  <p className={`text-[10px] md:text-xs mt-1.5 md:mt-2 opacity-70 ${message.role === 'user' ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                    {formatTime(message.timestamp)}
                  </p>
                </CardContent>
              </Card>

              {message.role === 'user' && (
                <div 
                  className="h-7 w-7 md:h-8 md:w-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ 
                    backgroundColor: interfaceConfig.primaryColor,
                    color: '#ffffff',
                    border: 'none',
                  }}
                >
                  <User className="h-3.5 w-3.5 md:h-4 md:w-4" style={{ color: '#ffffff' }} />
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-2 md:gap-3 justify-start">
              <div className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Bot className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary-foreground" />
              </div>
              <Card className="bg-card shadow-sm">
                <CardContent className="p-2.5 md:p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-primary rounded-full animate-pulse"></div>
                      <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-primary rounded-full animate-pulse delay-75"></div>
                      <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-primary rounded-full animate-pulse delay-150"></div>
                    </div>
                    <span className="text-xs md:text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Bottom Section: Suggestions and Input */}
      <div className="flex-shrink-0">
        {/* Follow-up suggestions */}
        {followUps.length > 0 && (
          <div 
            className="p-3 md:p-4 border-t"
            style={{ backgroundColor: interfaceConfig.primaryColorRgba }}
          >
            <p className="text-xs md:text-sm font-medium mb-2 text-foreground">Suggested follow-ups:</p>
            <div className="flex flex-wrap gap-1.5 md:gap-2 max-h-32 overflow-y-auto scrollbar-citadel">
              {followUps.map((suggestion) => {
                const iconMap: { [key: string]: React.ReactNode } = {
                  'Building': <Building className="h-4 w-4" />,
                  'Sparkles': <Sparkles className="h-4 w-4" />,
                  'MessageSquare': <MessageSquare className="h-4 w-4" />,
                  'HelpCircle': <HelpCircle className="h-4 w-4" />,
                  'Lightbulb': <Lightbulb className="h-4 w-4" />,
                  'Search': <Search className="h-4 w-4" />,
                };
                
                return (
                  <div
                    key={suggestion.id}
                    className="inline-flex items-center rounded-full border border-transparent px-2 md:px-2.5 py-0.5 text-xs font-semibold transition-colors cursor-pointer gap-1"
                    style={{
                      backgroundColor: interfaceConfig.primaryColorRgba,
                      color: interfaceConfig.primaryColor,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = interfaceConfig.primaryColor;
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = interfaceConfig.primaryColorRgba;
                      e.currentTarget.style.color = interfaceConfig.primaryColor;
                    }}
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {iconMap[suggestion.icon || 'MessageSquare']}
                    {suggestion.text}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Default suggestions */}
        {configuredSuggestions.length > 0 && followUps.length === 0 && (
          <div 
            className="p-3 md:p-4 border-t"
            style={{ backgroundColor: interfaceConfig.primaryColorRgba }}
          >
            <p className="text-xs md:text-sm font-medium mb-2 text-foreground">Suggested actions:</p>
            <div className="flex flex-wrap gap-1.5 md:gap-2 max-h-32 overflow-y-auto scrollbar-citadel">
              {configuredSuggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="inline-flex items-center rounded-full border border-transparent px-2 md:px-2.5 py-0.5 text-xs font-semibold transition-colors cursor-pointer gap-1"
                  style={{
                    backgroundColor: interfaceConfig.primaryColorRgba,
                    color: interfaceConfig.primaryColor,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = interfaceConfig.primaryColor;
                    e.currentTarget.style.color = '#ffffff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = interfaceConfig.primaryColorRgba;
                    e.currentTarget.style.color = interfaceConfig.primaryColor;
                  }}
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion.icon}
                  {suggestion.text}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t p-3 md:p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder="Ask me anything..."
              disabled={isLoading}
              className="sacred-transition text-sm md:text-base"
              style={{
                '--ring-color': interfaceConfig.primaryColor,
              } as React.CSSProperties & { '--ring-color': string }}
              onFocus={(e) => {
                e.currentTarget.style.outline = `2px solid ${interfaceConfig.primaryColor}`;
                e.currentTarget.style.outlineOffset = '2px';
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = '';
                e.currentTarget.style.outlineOffset = '';
              }}
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              size="icon"
              className="sacred-transition"
              style={{
                backgroundColor: interfaceConfig.primaryColor,
                color: '#ffffff',
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled && interfaceConfig.primaryRgb) {
                  // Darken the color on hover
                  e.currentTarget.style.backgroundColor = `rgb(${Math.max(0, interfaceConfig.primaryRgb.r - 20)}, ${Math.max(0, interfaceConfig.primaryRgb.g - 20)}, ${Math.max(0, interfaceConfig.primaryRgb.b - 20)})`;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = interfaceConfig.primaryColor;
              }}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const ChatInterface = memo(ChatInterfaceComponent);
