// Type for MemoryVectorStore
type MemoryVectorStoreType = {
  similaritySearch: (query: string, k: number) => Promise<Array<{ pageContent: string }>>;
};
import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import { ChatMessage } from '@prisma/client';
import VectorStoreService from './vectorStore';
import { Response } from 'express';
import { logger } from '@shared/utils';
import { config } from '../config';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY || "");

const mapRoleToGemini = (role: string): 'user' | 'model' => {
  return role === 'USER' ? 'user' : 'model';
};

export const generateResponse = async (chatbotId: string, systemPrompt: string, history: ChatMessage[], userMessage: string) => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
    });

    const chatHistory: Content[] = history.map(msg => ({
      role: mapRoleToGemini(msg.role),
      parts: [{ text: msg.content }],
    }));

    const vectorStore: MemoryVectorStoreType | undefined = await VectorStoreService.getVectorStore(chatbotId);
    let augmentedUserMessage = userMessage;

    if (vectorStore) {
      const similarDocs = await vectorStore.similaritySearch(userMessage, 1);
      if (similarDocs.length > 0) {
        augmentedUserMessage = `Context: ${similarDocs[0].pageContent}\n\nQuestion: ${userMessage}`;
      }
    }

    const chat = model.startChat({
      history: chatHistory,
    });

    const result = await chat.sendMessage(augmentedUserMessage);
    const response = await result.response;
    return response.text();
  } catch (error) {
    logger.error('Error generating response from Gemini', error instanceof Error ? error : undefined, {
      service: 'gemini',
    });
    return "I'm sorry, I'm having trouble connecting to my brain right now. Please try again later.";
  }
};

export const generateStreamingResponse = async (
  chatbotId: string, 
  systemPrompt: string, 
  history: ChatMessage[], 
  userMessage: string,
  res: Response,
  chatSessionId?: string
): Promise<string> => {
  let fullResponse = '';

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
    });

    const chatHistory: Content[] = history.map(msg => ({
      role: mapRoleToGemini(msg.role),
      parts: [{ text: msg.content }],
    }));

    const vectorStore: MemoryVectorStoreType | undefined = await VectorStoreService.getVectorStore(chatbotId);
    let augmentedUserMessage = userMessage;

    if (vectorStore) {
      const similarDocs = await vectorStore.similaritySearch(userMessage, 1);
      if (similarDocs.length > 0) {
        augmentedUserMessage = `Context: ${similarDocs[0].pageContent}\n\nQuestion: ${userMessage}`;
      }
    }

    const chat = model.startChat({
      history: chatHistory,
    });

    // Set up Server-Sent Events headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Send initial metadata
    if (chatSessionId) {
      res.write(`data: ${JSON.stringify({
        type: 'metadata',
        chatSessionId: chatSessionId
      })}\n\n`);
    }

    try {
      const result = await chat.sendMessageStream(augmentedUserMessage);
      
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          fullResponse += chunkText;
          
          // Send chunk to client
          res.write(`data: ${JSON.stringify({
            type: 'chunk',
            content: chunkText
          })}\n\n`);
        }
      }

      // Send completion event
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        fullResponse: fullResponse
      })}\n\n`);

    } catch (streamError) {
      logger.error('Error in streaming response from Gemini', streamError instanceof Error ? streamError : undefined, {
        service: 'gemini',
      });
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: 'Streaming error occurred'
      })}\n\n`);
    }

    // Don't end the response here - let the caller handle it
    return fullResponse;

  } catch (error) {
    logger.error('Error generating streaming response from Gemini', error instanceof Error ? error : undefined, {
      service: 'gemini',
    });
    
    // Only write error if headers haven't been sent yet
    if (!res.headersSent) {
      res.writeHead(500, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      });
    }
    
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: "I'm sorry, I'm having trouble connecting to my brain right now. Please try again later."
    })}\n\n`);
    res.end();
    return "I'm sorry, I'm having trouble connecting to my brain right now. Please try again later.";
  }
};
