import { ChatMessage } from '@prisma/client';
import { Response } from 'express';
import type { Source } from '../contextRetrievalService';
import type { FollowUpSuggestion } from '../followUpGenerator';
import type { CalendarEvent } from '../calendarProviders/types';

/**
 * Request interface for chat answering service
 */
export interface ChatAnsweringRequest {
  message: string;
  chatbotId: string;
  sessionId?: string;
  userId?: string;
  slackUserId?: string; // Slack user ID for OAuth connection storage
  apiToken?: string; // For API integration
  history?: ChatMessage[];
  // For widget/API endpoints that don't use database sessions
  useInMemorySession?: boolean;
  // Additional system prompt instructions (e.g., for widget conciseness)
  additionalSystemInstructions?: string;
  // Whether to include Mermaid diagram generation capability in system prompt
  // Set to false for bubble/widget and API integrations
  includeMermaidDiagrams?: boolean;
  headers?: Record<string, string>; // For detecting integration type
  userTimezone?: string; // User's IANA timezone (e.g., 'America/New_York', 'Europe/Paris')
}

/**
 * Response interface for chat answering service
 */
export interface ChatAnsweringResponse {
  response: string;
  sources: Source[];
  followUps: FollowUpSuggestion[];
  sessionId: string;
  metadata?: {
    chatbotId: string;
    provider?: string;
    model?: string;
  };
  requiresConfirmation?: boolean;
  confirmationType?: 'web' | 'slack' | 'api';
  pendingAction?: {
    confirmationToken: string;
    action: 'create' | 'update' | 'delete';
    eventDetails: {
      summary?: string;
      start?: string;
      end?: string;
      location?: string;
      attendees?: string[];
    };
    confirmUrl?: string;
  };
}

/**
 * Streaming options for chat responses
 */
export interface StreamingOptions {
  enabled: boolean;
  response?: Response;
  sessionId?: string;
}

/**
 * Session management result
 */
export interface SessionResult {
  sessionId: string;
  chatbotId: string;
  history: ChatMessage[];
  chatSession: { id: string; chatbotId: string } | null;
}

/**
 * Context retrieval result
 */
export interface ContextResult {
  weaviateContext: string;
  cloudContext: string;
  dbContext: string;
  calendarContext: string;
  sources: Source[];
  authRequirements: AuthRequirement[];
  availableCalendarEvents: CalendarEvent[];
}

/**
 * Authentication requirement for calendar blocks
 */
export interface AuthRequirement {
  provider: string;
  authUrl?: string;
  blockId: string;
  serverUrl?: string;
  retryCount?: number;
}

/**
 * Database block result
 */
export interface DbBlockResult {
  data?: string;
  blockId?: string;
  metadata?: Record<string, unknown>;
}

// Re-export Source for convenience
export type { Source } from '../contextRetrievalService';
export type { FollowUpSuggestion } from '../followUpGenerator';
export type { CalendarEvent } from '../calendarProviders/types';
