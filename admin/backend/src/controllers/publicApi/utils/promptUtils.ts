import { Block } from '@prisma/client';

/**
 * Generate system prompt
 */
export function generateSystemPrompt(systemPromptBlock: Block | null, contextBlocks: Block[], context: string): string {
  // Get current date
  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  if (!systemPromptBlock) {
    return `You are a helpful assistant.\n\nToday's date is: ${currentDate}\n\nIMPORTANT: Always prioritize and use the newest, most up-to-date knowledge available. When multiple sources contain conflicting information, prefer the most recent information.\n\nUse the following context to answer the user's question:\n\n${context}`;
  }

  const properties = systemPromptBlock.properties as Record<string, unknown>;
  const botName = String(properties.botName || 'Assistant');
  const companyName = String(properties.companyName || '');
  const behavior = String(properties.behavior || 'helpful');
  const additionalInstructions = String(properties.additionalInstructions || '');
  const manualPrompt = String(properties.prompt || '');

  if (manualPrompt && manualPrompt.length > 50) {
    return `${manualPrompt}\n\nToday's date is: ${currentDate}\n\nIMPORTANT: Always prioritize and use the newest, most up-to-date knowledge available. When multiple sources contain conflicting information, prefer the most recent information.\n\nUse the following context to answer the user's question:\n\n${context}`;
  }

  let systemPrompt = `You are ${botName}`;
  if (companyName) {
    systemPrompt += `, an AI assistant for ${companyName}`;
  }
  systemPrompt += `. Be ${behavior} and helpful.`;

  // Add current date
  systemPrompt += `\n\nToday's date is: ${currentDate}`;

  if (contextBlocks.length > 0) {
    systemPrompt += `\n\nYou have access to knowledge sources. Use this information to provide accurate responses.`;
  }

  // Always add instruction to use newest knowledge (context can come from various sources)
  systemPrompt += `\n\nIMPORTANT: Always prioritize and use the newest, most up-to-date knowledge available. When multiple sources contain conflicting information, prefer the most recent information.`;

  if (additionalInstructions) {
    systemPrompt += `\n\nAdditional instructions: ${additionalInstructions}`;
  }

  return `${systemPrompt}\n\nUse the following context to answer the user's question:\n\n${context}`;
}
