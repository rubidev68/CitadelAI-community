/**
 * Slack API Type Definitions
 * 
 * Comprehensive type definitions for Slack API interactions,
 * including messages, events, webhooks, and OAuth.
 */

/**
 * Slack message structure
 */
export interface SlackMessage {
  channel: string;
  text?: string;
  blocks?: SlackBlock[];
  thread_ts?: string;
  mrkdwn?: boolean;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
}

/**
 * Slack block kit block types
 */
export type SlackBlockType =
  | 'section'
  | 'divider'
  | 'image'
  | 'actions'
  | 'context'
  | 'input'
  | 'file'
  | 'header'
  | 'rich_text';

/**
 * Slack block structure
 */
export interface SlackBlock {
  type: SlackBlockType;
  block_id?: string;
  text?: SlackTextObject;
  image_url?: string;
  alt_text?: string;
  elements?: SlackBlockElement[];
  fields?: SlackTextObject[];
  accessory?: SlackBlockElement;
  [key: string]: unknown;
}

/**
 * Slack text object
 */
export interface SlackTextObject {
  type: 'plain_text' | 'mrkdwn';
  text: string;
  emoji?: boolean;
  verbatim?: boolean;
}

/**
 * Slack block element (button, select, etc.)
 */
export interface SlackBlockElement {
  type: string;
  text?: SlackTextObject;
  action_id?: string;
  value?: string;
  url?: string;
  style?: 'primary' | 'danger';
  confirm?: SlackConfirmationDialog;
  options?: SlackOption[];
  [key: string]: unknown;
}

/**
 * Slack confirmation dialog
 */
export interface SlackConfirmationDialog {
  title: SlackTextObject;
  text: SlackTextObject;
  confirm: SlackTextObject;
  deny: SlackTextObject;
  style?: 'primary' | 'danger';
}

/**
 * Slack option
 */
export interface SlackOption {
  text: SlackTextObject;
  value: string;
  description?: SlackTextObject;
}

/**
 * Slack user information
 */
export interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
  display_name?: string;
  email?: string;
  image_24?: string;
  image_32?: string;
  image_48?: string;
  image_72?: string;
  image_192?: string;
  image_512?: string;
  team_id?: string;
}

/**
 * Slack channel information
 */
export interface SlackChannel {
  id: string;
  name: string;
  is_channel?: boolean;
  is_group?: boolean;
  is_im?: boolean;
  is_private?: boolean;
  is_archived?: boolean;
  is_member?: boolean;
  created?: number;
  creator?: string;
  num_members?: number;
  topic?: {
    value: string;
    creator: string;
    last_set: number;
  };
  purpose?: {
    value: string;
    creator: string;
    last_set: number;
  };
}

/**
 * Slack API response wrapper
 */
export interface SlackApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  warning?: string;
  response_metadata?: {
    next_cursor?: string;
    warnings?: string[];
  };
}

/**
 * Slack post message response
 */
export interface SlackPostMessageResponse {
  ok: boolean;
  channel?: string;
  ts?: string;
  message?: {
    text: string;
    user: string;
    ts: string;
    [key: string]: unknown;
  };
  error?: string;
  warning?: string;
}

/**
 * Slack update message response
 */
export interface SlackUpdateMessageResponse {
  ok: boolean;
  channel?: string;
  ts?: string;
  text?: string;
  error?: string;
}

/**
 * Slack event types
 */
export type SlackEventType =
  | 'message'
  | 'app_mention'
  | 'app_home_opened'
  | 'channel_created'
  | 'channel_archive'
  | 'channel_unarchive'
  | 'member_joined_channel'
  | 'member_left_channel'
  | 'team_join'
  | 'url_verification';

/**
 * Slack event structure
 */
export interface SlackEvent {
  type: SlackEventType;
  event_ts?: string;
  user?: string;
  text?: string;
  channel?: string;
  channel_type?: string;
  team?: string;
  ts?: string;
  item?: {
    type: string;
    channel?: string;
    ts?: string;
  };
  [key: string]: unknown;
}

/**
 * Slack webhook payload
 */
export interface SlackWebhookPayload {
  token?: string;
  team_id?: string;
  api_app_id?: string;
  event?: SlackEvent;
  type: 'event_callback' | 'url_verification';
  challenge?: string;
  event_id?: string;
  event_time?: number;
  authed_users?: string[];
  authed_teams?: string[];
}

/**
 * Slack OAuth response
 */
export interface SlackOAuthResponse {
  ok: boolean;
  access_token?: string;
  token_type?: string;
  scope?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: {
    id: string;
    name: string;
  };
  enterprise?: {
    id: string;
    name: string;
  };
  authed_user?: {
    id: string;
    scope?: string;
    access_token?: string;
    token_type?: string;
  };
  error?: string;
  error_description?: string;
}

/**
 * Slack OAuth state structure
 */
export interface SlackOAuthState {
  chatbotId: string;
  blockId: string;
  timestamp: number;
  nonce: string;
}

/**
 * Slack webhook verification result
 */
export interface SlackWebhookVerificationResult {
  valid: boolean;
  challenge?: string;
  event?: SlackEvent;
  error?: string;
}

/**
 * Slack action payload (for interactive components)
 */
export interface SlackActionPayload {
  type: 'block_actions' | 'interactive_message' | 'dialog_submission' | 'message_action';
  user: {
    id: string;
    name: string;
    username?: string;
  };
  channel?: {
    id: string;
    name: string;
  };
  actions?: Array<{
    action_id: string;
    block_id?: string;
    value?: string;
    type?: string;
    [key: string]: unknown;
  }>;
  response_url?: string;
  message?: {
    ts: string;
    text?: string;
    blocks?: SlackBlock[];
  };
  [key: string]: unknown;
}
