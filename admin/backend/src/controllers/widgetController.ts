import { Request, Response } from 'express';
import { BlockType } from '@prisma/client';
import prisma from '../lib/prisma';
import { logger } from '@shared/utils';
import { generateWidgetScript } from '../utils/widgetScriptGenerator';

const widgetControllerLogger = logger.child({ service: 'admin-backend', component: 'widget-controller' });

// Handler for bubble script generation
export async function handleBubbleScript(req: Request, res: Response): Promise<void> {
  try {
    const { chatbotId } = req.params;
    
    // Validate chatbot exists (allow ACTIVE or DRAFT status for widget)
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      include: { blocks: true }
    });
    
    if (!chatbot) {
      res.status(404).send('// Chatbot not found');
      return;
    }
    
    if (chatbot.status !== 'ACTIVE' && chatbot.status !== 'DRAFT') {
      res.status(404).send(`// Chatbot is ${chatbot.status}`);
      return;
    }
    
    const bubbleBlock = chatbot.blocks.find(
      b => b.type === BlockType.FRONTEND && b.subtype === 'Bubble'
    );
    
    if (!bubbleBlock) {
      res.status(404).send(`// Bubble block not configured for chatbot ${chatbotId}. Please add a Bubble block in the admin interface.`);
      return;
    }
    
    const properties = bubbleBlock.properties as Record<string, any>;
    // Construct the public API URL (same domain for both admin and user backend)
    const protocol = 'https';
    const host = req.get('host') || 'api.citadelai.app';
    const apiBaseUrl = `${protocol}://${host}`;
    
    // Generate widget script
    let widgetScript: string;
    try {
      widgetScript = generateWidgetScript(chatbotId, properties, apiBaseUrl);
    } catch (scriptError) {
      widgetControllerLogger.error('Error generating widget script for chatbot', { chatbotId, error: scriptError instanceof Error ? scriptError : new Error(String(scriptError)) });
      res.status(500).send(`// Error generating widget script: ${scriptError instanceof Error ? scriptError.message : 'Unknown error'}`);
      return;
    }
    
    if (!widgetScript || widgetScript.trim().length === 0) {
      widgetControllerLogger.error('Generated widget script is empty for chatbot', { chatbotId });
      res.status(500).send('// Error: Widget script generation failed - empty script');
      return;
    }
    
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
    res.send(widgetScript);
  } catch (error) {
    widgetControllerLogger.error('Error generating widget script', { error: error instanceof Error ? error : new Error(String(error)) });
    if (!res.headersSent) {
      res.status(500).send(`// Error generating widget script: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Handler for widget configuration
export async function handleWidgetConfig(req: Request, res: Response): Promise<void> {
  try {
    const { chatbotId } = req.params;
    
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId, status: 'ACTIVE' },
      include: { blocks: true }
    });
    
    if (!chatbot) {
      res.status(404).json({ error: 'Chatbot not found' });
      return;
    }
    
    const bubbleBlock = chatbot.blocks.find(
      b => b.type === BlockType.FRONTEND && b.subtype === 'Bubble'
    );
    
    if (!bubbleBlock) {
      res.status(404).json({ error: 'Bubble block not configured' });
      return;
    }
    
    // Construct the public API URL (same domain for both admin and user backend)
    const protocol = 'https';
    const host = req.get('host') || 'api.citadelai.app';
    const apiBaseUrl = `${protocol}://${host}`;
    
    res.setHeader('Cache-Control', 'public, max-age=300');
    const properties = bubbleBlock.properties as Record<string, any>;
    res.json({
      chatbotId,
      ...properties,
      apiEndpoint: `${apiBaseUrl}/api/chat/respond-streaming-widget`
    });
  } catch (error) {
    widgetControllerLogger.error('Error getting widget config', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Handler for embed code generation
export async function handleEmbedCode(req: Request, res: Response): Promise<void> {
  try {
    const { chatbotId } = req.params;
    // TODO: Add admin authentication
    
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      include: { blocks: true }
    });
    
    if (!chatbot) {
      res.status(404).json({ error: 'Chatbot not found' });
      return;
    }
    
    const bubbleBlock = chatbot.blocks.find(
      b => b.type === BlockType.FRONTEND && b.subtype === 'Bubble'
    );
    
    if (!bubbleBlock) {
      res.status(404).json({ error: 'Bubble block not configured' });
      return;
    }
    
    // Always use HTTPS for embed code
    const protocol = 'https';
    const host = req.get('host') || 'api.citadelai.app';
    const scriptUrl = `${protocol}://${host}/api/widget/${chatbotId}/bubble.js`;
    
    // Token is not actually used in the widget script, so we can simplify the embed code
    const embedCode = `<script src="${scriptUrl}"></script>`;
    
    res.json({
      embedCode,
      instructions: 'Copy and paste this code before the closing </body> tag of your website.'
    });
  } catch (error) {
    widgetControllerLogger.error('Error generating embed code', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Internal server error' });
  }
}
