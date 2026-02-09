
import { useEffect, useState } from "react";
import { getChatbots } from "@/lib/api";
import { Button } from "@/components/ui/button";

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

interface ChatbotListProps {
  onSelectChatbot: (chatbot: Chatbot) => void;
}

export const ChatbotList: React.FC<ChatbotListProps> = ({ onSelectChatbot }) => {
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChatbots = async () => {
      try {
        const data = await getChatbots();
        setChatbots(data);
      } catch (error) {
        setError("Failed to fetch chatbots");
      } finally {
        setIsLoading(false);
      }
    };

    fetchChatbots();
  }, []);

  if (isLoading) {
    return <div>Loading chatbots...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className="p-3 md:p-4">
      <h2 className="text-lg md:text-xl font-bold mb-3 md:mb-4">Available Chatbots</h2>
      {chatbots.length > 0 ? (
        <div className="space-y-2">
          {chatbots.map((chatbot) => (
            <div key={chatbot.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 md:p-4 border rounded-md">
              <span className="text-sm md:text-base font-medium">{chatbot.name}</span>
              <Button 
                onClick={() => onSelectChatbot(chatbot)}
                className="w-full sm:w-auto"
              >
                Select
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-500 p-4">
          <p className="text-sm md:text-base">No chatbots have been assigned to you yet.</p>
          <p className="text-sm md:text-base mt-2">Please contact an administrator to get access.</p>
        </div>
      )}
    </div>
  );
};
