import { createLLMService, LLMProvider } from './llmService';
import { ChatMessage } from '@prisma/client';
import { logger } from '@shared/utils';

export interface FollowUpSuggestion {
  id: string;
  text: string;
  icon?: string;
}

export const generateFollowUps = async (
  chatbotId: string,
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
  assistantResponse: string,
  context?: string,
  llmProvider: LLMProvider = 'gemini',
  llmModel: string = 'gemini-2.5-flash'
): Promise<FollowUpSuggestion[]> => {
  try {
    const llmService = createLLMService(llmProvider, llmModel);

    // Create the follow-up generation prompt
    const followUpPrompt = `Based on the following conversation, generate exactly 3 brief, natural follow-up questions that a user might want to ask next.

Recent user question: ${userMessage}

Assistant response: ${assistantResponse}

${context ? `Available context: ${context}` : ''}

IMPORTANT: Only suggest follow-up questions about topics you're sure to have information on. Each suggestion should be specific and directly related to the conversation context.

You must respond with ONLY a valid JSON object in this exact format (no other text):
{
  "suggestions": [
    {"id": "1", "text": "First follow-up question", "icon": "HelpCircle"},
    {"id": "2", "text": "Second follow-up question", "icon": "Lightbulb"},
    {"id": "3", "text": "Third follow-up question", "icon": "Search"}
  ]
}

Available icons: HelpCircle, Lightbulb, Search, MessageSquare, Building, Sparkles

Respond with only the JSON object, no explanations or additional text.`;

    const responseText = await llmService.generateResponse(
      chatbotId,
      `${systemPrompt}\n\nIMPORTANT: When generating follow-up suggestions, you must respond with ONLY a valid JSON object. Do not include any explanations, markdown formatting, or additional text.`,
      history,
      followUpPrompt
    );
    

    // Try to parse the JSON response
    try {
      // Clean the response text to extract JSON
      let cleanResponse = responseText.trim();
      
      // Remove any markdown code blocks
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Try to find JSON object in the response
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanResponse = jsonMatch[0];
      }
      
      const parsed = JSON.parse(cleanResponse) as {
        suggestions?: Array<{ id?: string; text?: string; icon?: string } | string>;
      };
      if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
        const suggestions = parsed.suggestions.map((suggestion) => {
          if (typeof suggestion === 'string') {
            return {
              id: (Date.now() + Math.random()).toString(),
              text: suggestion,
              icon: 'MessageSquare'
            };
          }
          return {
            id: suggestion.id || (Date.now() + Math.random()).toString(),
            text: suggestion.text || String(suggestion),
            icon: suggestion.icon || 'MessageSquare'
          };
        });
        return suggestions;
      }
    } catch (parseError) {
      // This is expected - LLM might return non-JSON response, we'll parse it as text
      // Suppress common JSON parsing errors (they're handled by text parsing fallback)
      const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
      // Only log unexpected errors, not common JSON parsing issues
      if (!errorMsg.includes('Unexpected token') && !errorMsg.includes('JSON')) {
        logger.warn('Failed to parse follow-up JSON, falling back to text parsing', {
          error: errorMsg,
          service: 'followUpGenerator',
        });
      }
      // Silently continue to text parsing fallback for common JSON errors
    }

    // Fallback: parse text response
    const lines = responseText.split('\n').filter(line => line.trim());
    const suggestions: FollowUpSuggestion[] = [];
    
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      let line = lines[i].trim();
      
      // Skip JSON-like lines
      if (line.startsWith('{') || line.startsWith('[') || line.startsWith('"suggestions"')) {
        continue;
      }
      
      // Clean up the line
      line = line.replace(/^\d+\.\s*/, ''); // Remove numbering
      line = line.replace(/^[-*]\s*/, ''); // Remove bullet points
      line = line.replace(/^"|"$/, ''); // Remove quotes
      
      if (line && line.length > 5) { // Only add meaningful suggestions
        suggestions.push({
          id: (Date.now() + i).toString(),
          text: line,
          icon: ['HelpCircle', 'Lightbulb', 'Search'][i] || 'MessageSquare'
        });
      }
    }
    
    // If we still don't have enough suggestions, add some defaults
    while (suggestions.length < 3) {
      const defaultSuggestions = [
        "Tell me more about this topic",
        "What else can you help me with?",
        "Can you explain this differently?"
      ];
      
      suggestions.push({
        id: (Date.now() + suggestions.length).toString(),
        text: defaultSuggestions[suggestions.length],
        icon: ['HelpCircle', 'Lightbulb', 'Search'][suggestions.length] || 'MessageSquare'
      });
    }

    return suggestions;

  } catch (error) {
    logger.error('Error generating follow-ups', error instanceof Error ? error : undefined, {
      service: 'followUpGenerator',
    });
    // Return default suggestions as fallback
    const defaultSuggestions = [
      {
        id: "1",
        text: "Tell me more about this topic",
        icon: "HelpCircle"
      },
      {
        id: "2", 
        text: "What else can you help me with?",
        icon: "Lightbulb"
      },
      {
        id: "3",
        text: "Can you explain this differently?",
        icon: "Search"
      }
    ];
    return defaultSuggestions;
  }
};