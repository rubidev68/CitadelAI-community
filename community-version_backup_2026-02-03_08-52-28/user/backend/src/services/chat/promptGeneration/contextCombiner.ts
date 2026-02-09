/**
 * Combine all context types into a single string
 */
export function combineContexts(
  weaviateContext: string,
  dbContext: string,
  cloudContext: string,
  calendarContext: string
): string {
  let combined = weaviateContext;

  if (dbContext) {
    combined += '\n\n' + dbContext;
  }

  if (cloudContext) {
    combined += '\n\n' + cloudContext;
  }

  if (calendarContext) {
    combined += '\n\n' + calendarContext;
  }

  return combined;
}
