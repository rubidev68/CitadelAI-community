import { Block } from '@prisma/client';

interface SystemPromptConfig {
  botName?: string;
  companyName?: string;
  behavior?: string;
  additionalInstructions?: string;
  llmProvider?: string;
  llmModel?: string;
}

const BEHAVIOR_DESCRIPTIONS = {
  helpful: 'Friendly, informative, and eager to help with any questions',
  professional: 'Formal, knowledgeable, and focused on providing expert advice',
  casual: 'Relaxed, conversational, and approachable in tone',
  technical: 'Precise, detailed, and focused on technical accuracy',
  creative: 'Imaginative, inspiring, and focused on creative solutions',
  supportive: 'Empathetic, patient, and focused on helping users succeed'
};

export function generateSystemPrompt(
  systemPromptBlock: Block | null,
  contextBlocks: Block[],
  context: string,
  includeMermaidDiagrams: boolean = true,
  actionBlocks?: Block[]
): string {
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
  const config: SystemPromptConfig = {
    botName: String(properties.botName || 'Assistant'),
    companyName: String(properties.companyName || ''),
    behavior: String(properties.behavior || 'helpful'),
    additionalInstructions: String(properties.additionalInstructions || '')
  };

  // If there's a manually set prompt, use it (for backward compatibility)
  const manualPrompt = String(properties.prompt || '');
  if (manualPrompt && manualPrompt !== 'You are a helpful AI assistant. Your role is to provide accurate and concise information to users. Don\'t be afraid to say you don\'t know.') {
    return `${manualPrompt}\n\nToday's date is: ${currentDate}\n\nIMPORTANT: Always prioritize and use the newest, most up-to-date knowledge available. When multiple sources contain conflicting information, prefer the most recent information.\n\nUse the following context to answer the user's question:\n\n${context}`;
  }

  // Generate prompt from configuration
  let systemPrompt = `You are ${config.botName}`;
  
  if (config.companyName) {
    systemPrompt += `, an AI assistant for ${config.companyName}`;
  }
  
  const behaviorDescription = BEHAVIOR_DESCRIPTIONS[config.behavior as keyof typeof BEHAVIOR_DESCRIPTIONS] || BEHAVIOR_DESCRIPTIONS.helpful;
  systemPrompt += `. ${behaviorDescription}`;
  
  // Add current date
  systemPrompt += `\n\nToday's date is: ${currentDate}`;
  
  if (contextBlocks.length > 0) {
    systemPrompt += `\n\nYou have access to the following knowledge sources:`;
    contextBlocks.forEach((contextBlock) => {
      if (contextBlock.subtype === 'Website') {
        const url = (contextBlock.properties as Record<string, unknown>)?.url;
        systemPrompt += `\n- Website: ${url || 'Connected website'}`;
      } else if (contextBlock.subtype === 'Document') {
        const filename = (contextBlock.properties as Record<string, unknown>)?.filename;
        systemPrompt += `\n- Document: ${filename || 'Connected document'}`;
      } else if (contextBlock.subtype === 'Cloud') {
        const provider = (contextBlock.properties as Record<string, unknown>)?.provider;
        const providerName = provider === 'nextcloud' ? 'Nextcloud' : 
                            provider === 'googledrive' ? 'Google Drive' : 
                            provider === 'onedrive' ? 'OneDrive' : 
                            'Cloud Storage';
        systemPrompt += `\n- Cloud Storage: ${providerName} (indexed files and folders)`;
      }
    });
    systemPrompt += `\n\nUse this information to provide accurate and helpful responses. Always cite your sources when referencing specific information.`;
  }
  
  // Add action capabilities if action blocks are present
  if (actionBlocks && actionBlocks.length > 0) {
    systemPrompt += `\n\n## Action Capabilities\n\nYou have the ability to perform the following actions on behalf of users:`;
    
    actionBlocks.forEach((actionBlock) => {
      if (actionBlock.subtype === 'Calendar') {
        const properties = actionBlock.properties as Record<string, unknown>;
        const actionConfig = properties.actionConfig as Record<string, unknown> | undefined;
        const allowedActions = (actionConfig?.allowedActions as string[]) || ['create'];
        
        let actionsList = '';
        if (allowedActions.includes('create')) {
          actionsList += 'create calendar events';
        }
        if (allowedActions.includes('update')) {
          if (actionsList) actionsList += ', ';
          actionsList += 'update calendar events';
        }
        if (allowedActions.includes('delete')) {
          if (actionsList) actionsList += ', ';
          actionsList += 'delete calendar events';
        }
        
        systemPrompt += `\n- **Calendar Management**: You can ${actionsList}. When a user asks you to schedule, create, add, book, or set up a calendar event, you should acknowledge their request and indicate that you will create the event. The system will handle the actual creation after user confirmation.`;
        
        // Add instructions about what information to extract
        systemPrompt += `\n  - When creating events, try to extract: event title/summary, start time, end time, location (if mentioned), and attendees (if mentioned).`;
        systemPrompt += `\n  - If the user doesn't provide complete information (like time or date), ask clarifying questions before proceeding.`;
        systemPrompt += `\n  - Always confirm the event details with the user before creating it.`;
      } else if (actionBlock.subtype === 'Send email') {
        systemPrompt += `\n- **Email**: You can send emails on behalf of users. When a user asks you to send an email, acknowledge the request and indicate that you will send it after confirmation.`;
      } else if (actionBlock.subtype === 'DB') {
        systemPrompt += `\n- **Database Operations**: You can query external databases to retrieve information.`;
      }
    });
    
    systemPrompt += `\n\n**Important**: When you detect that a user wants to perform an action (like creating a calendar event), acknowledge their request naturally in your response. The system will automatically detect the action intent and prompt the user for confirmation before executing it.`;
  }
  
  // Always add instruction to use newest knowledge (context can come from various sources)
  systemPrompt += `\n\nIMPORTANT: Always prioritize and use the newest, most up-to-date knowledge available. When multiple sources contain conflicting information, prefer the most recent information.`;
  
  if (config.additionalInstructions) {
    systemPrompt += `\n\nAdditional instructions: ${config.additionalInstructions}`;
  }
  
  systemPrompt += `\n\nRemember to be helpful, accurate, and professional in all your interactions.`;
  
  // Add mermaid graph generation capability only if enabled
  if (includeMermaidDiagrams) {
    systemPrompt += `\n\nYou can generate Mermaid diagrams and graphs when appropriate. When you want to create a visual diagram, flowchart, sequence diagram, or any other graph, wrap the Mermaid code in a markdown code block with language "mermaid". For example:\n\n\`\`\`mermaid\ngraph TD\n    A[Start] --> B[Process]\n    B --> C[End]\n\`\`\`\n\nUse Mermaid diagrams to visualize processes, relationships, hierarchies, workflows, or any other concepts that would benefit from a visual representation.`;
  }
  
  return `${systemPrompt}\n\nUse the following context to answer the user's question:\n\n${context}`;
}