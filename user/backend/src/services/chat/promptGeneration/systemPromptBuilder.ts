import { Block } from '@prisma/client';
import { generateSystemPrompt } from '../../../utils/systemPromptGenerator';

/**
 * Build system prompt with all context and blocks
 */
export function buildSystemPrompt(
  systemPromptBlock: Block | null,
  contextBlocks: Block[],
  combinedContext: string,
  includeMermaid: boolean,
  actionBlocks: Block[],
  additionalInstructions?: string
): string {
  let prompt = generateSystemPrompt(
    systemPromptBlock,
    contextBlocks,
    combinedContext,
    includeMermaid,
    actionBlocks
  );

  if (additionalInstructions) {
    prompt += '\n\n' + additionalInstructions;
  }

  return prompt;
}
