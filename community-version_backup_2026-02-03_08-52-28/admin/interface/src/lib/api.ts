import { adminApiClient, userApiClient, handleApiResponse } from './apiClient';

// Helper function to hash a string using the browser's built-in SHA-256 capabilities.
async function sha256(message: string): Promise<string> {
  // Encode the message as UTF-8
  const msgBuffer = new TextEncoder().encode(message);
  // Hash the message
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  // Convert ArrayBuffer to a hexadecimal string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export const registerUser = async (email: string, password: string, company?: string, name?: string, invitationCode?: string) => {
  const hashedPassword = await sha256(password);
  const response = await adminApiClient.post('/auth/register', { 
    email, 
    password: hashedPassword, 
    company, 
    name, 
    role: 'ARCHITECT',
    invitationCode
  });
  return handleApiResponse(response);
};

export const verifyEmail = async (token: string) => {
  const response = await adminApiClient.post('/auth/verify-email', { token });
  return handleApiResponse(response);
};

export const resendVerificationEmail = async (email: string) => {
  const response = await adminApiClient.post('/auth/resend-verification-email', { email });
  return handleApiResponse(response);
};

// Password reset API functions
export const requestPasswordReset = async (email: string): Promise<{ success: boolean; message: string }> => {
  const response = await adminApiClient.post('/auth/forgot-password', { email });
  return handleApiResponse(response) as Promise<{ success: boolean; message: string }>;
};

export const resetPassword = async (
  token: string,
  email: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> => {
  const hashedPassword = await sha256(newPassword);
  const response = await adminApiClient.post('/auth/reset-password', {
    token,
    email,
    newPassword: hashedPassword,
  });
  return handleApiResponse(response) as Promise<{ success: boolean; message: string }>;
};

export const loginUser = async (email: string, password: string) => {
  const hashedPassword = await sha256(password);
  const response = await adminApiClient.post('/auth/login', { 
    email, 
    password: hashedPassword 
  });
  return handleApiResponse(response);
};

// 2FA API functions
export interface TwoFactorRequiredResponse {
  requiresTwoFactor: true;
  tempToken: string;
}

export interface TwoFactorSetupResponse {
  secret: string;
  qrCode: string;
  manualEntryKey: string;
  setupToken: string;
}

export interface TwoFactorSetupCompleteResponse {
  success: boolean;
  backupCodes: string[];
  message: string;
}

export interface VerifyTwoFactorData {
  tempToken: string;
  otp?: string;
  backupCode?: string;
}

export const verifyTwoFactor = async (data: VerifyTwoFactorData) => {
  const response = await adminApiClient.post('/auth/login/verify-2fa', data);
  return handleApiResponse(response);
};

export const initiateTwoFactorSetup = async (token: string): Promise<TwoFactorSetupResponse> => {
  const response = await adminApiClient.post('/auth/2fa/setup/initiate', undefined, token);
  return handleApiResponse(response) as Promise<TwoFactorSetupResponse>;
};

export const verifyTwoFactorSetup = async (otp: string, setupToken: string, token: string): Promise<TwoFactorSetupCompleteResponse> => {
  const response = await adminApiClient.post('/auth/2fa/setup/verify', { otp, setupToken }, token);
  return handleApiResponse(response) as Promise<TwoFactorSetupCompleteResponse>;
};

export const disableTwoFactor = async (password: string, otp: string, token: string): Promise<{ success: boolean; message: string }> => {
  const hashedPassword = await sha256(password);
  const response = await adminApiClient.post('/auth/2fa/disable', { password: hashedPassword, otp }, token);
  return handleApiResponse(response) as Promise<{ success: boolean; message: string }>;
};

export const regenerateBackupCodes = async (otp: string, token: string): Promise<{ backupCodes: string[]; message: string }> => {
  const response = await adminApiClient.post('/auth/2fa/backup-codes/regenerate', { otp }, token);
  return handleApiResponse(response) as Promise<{ backupCodes: string[]; message: string }>;
};

export const createChatbot = async (name: string, token: string, description?: string) => {
  const response = await adminApiClient.post('/chatbots', { name, description }, token);
  return handleApiResponse(response);
};

export const getChatbot = async (id: string, token: string) => {
  const response = await adminApiClient.get(`/chatbots/${id}`, token);
  return handleApiResponse(response);
};

export const updateChatbotStatus = async (id: string, status: 'ACTIVE' | 'INACTIVE', token: string) => {
  const response = await adminApiClient.put(`/chatbots/${id}`, { status }, token);
  return handleApiResponse(response);
};

export const getChatbots = async (token: string) => {
  const response = await adminApiClient.get('/chatbots', token);
  return handleApiResponse(response);
};

export const getChatbotUsers = async (id: string, token: string) => {
  const response = await adminApiClient.get(`/chatbots/${id}/users`, token);
  return handleApiResponse(response);
};

export const addChatbotUser = async (id: string, email: string, token: string) => {
  const response = await adminApiClient.post(`/chatbots/${id}/users`, { email }, token);
  return handleApiResponse(response);
};

export const removeChatbotUser = async (id: string, accessId: string, token: string) => {
  const response = await adminApiClient.delete(`/chatbots/${id}/users/${accessId}`, token);
  return handleApiResponse(response);
};

export const deleteChatbot = async (id: string, token: string) => {
  const response = await adminApiClient.delete(`/chatbots/${id}`, token);
  return handleApiResponse(response);
};

interface ChatbotUpdateData {
  name: string;
  [key: string]: unknown;
}

export const updateChatbot = async (id: string, chatbotData: ChatbotUpdateData, token: string) => {
  const response = await adminApiClient.put(`/chatbots/${id}`, chatbotData, token);
  return handleApiResponse(response);
};

export const loginAsTestUser = async (token: string) => {
  const response = await adminApiClient.post('/auth/login-as-test-user', undefined, token);
  return handleApiResponse(response);
};

export const getMe = async (token: string) => {
  const response = await adminApiClient.get('/me', token);
  return handleApiResponse(response);
};

export const updateTutorialCompletion = async (tutorialCompleted: boolean, token: string) => {
  const response = await adminApiClient.put('/tutorial-completion', { tutorialCompleted }, token);
  return handleApiResponse(response);
};

export const updateUserProfile = async (profileData: { name: string; email: string; company?: string }, token: string) => {
  const response = await adminApiClient.put('/profile', profileData, token);
  return handleApiResponse(response);
};

export const changePassword = async (currentPassword: string, newPassword: string, token: string) => {
  const hashedCurrentPassword = await sha256(currentPassword);
  const hashedNewPassword = await sha256(newPassword);
  const response = await adminApiClient.put('/change-password', {
    currentPassword: hashedCurrentPassword, 
    newPassword: hashedNewPassword 
  }, token);
  return handleApiResponse(response);
};

export const deleteAccount = async (token: string) => {
  const response = await adminApiClient.delete('/delete-account', token);
  return handleApiResponse(response);
};

export const crawlWebsite = async (url: string, chatbotId: string, blockId: string, token: string, recursive = false, maxDepth = 3) => {
  const response = await adminApiClient.post('/crawl', { url, chatbotId, blockId, recursive, maxDepth }, token);
  return handleApiResponse(response);
};

export const getCrawlingStatus = async (blockId: string, token: string) => {
  const response = await adminApiClient.get(`/status/${blockId}`, token);
  return handleApiResponse(response);
};

export const stopCrawlWebsite = async (chatbotId: string, blockId: string, token: string) => {
  const response = await adminApiClient.post('/stop', { chatbotId, blockId }, token);
  return handleApiResponse(response);
};

interface CrawledPage {
  url: string;
  title?: string;
  content?: string;
  chatbotId?: string;
  blockId?: string;
}

export const getCrawledPages = async (chatbotId: string, blockId: string, token: string): Promise<CrawledPage[]> => {
  const response = await adminApiClient.get(`/crawled-pages/${blockId}?chatbotId=${chatbotId}`, token);
  return handleApiResponse(response) as Promise<CrawledPage[]>;
};

export const updateCronSettings = async (blockId: string, cronEnabled: boolean, cronSchedule: string, cronTimezone: string, token: string) => {
  const response = await adminApiClient.post('/cron/update', { blockId, cronEnabled, cronSchedule, cronTimezone }, token);
  return handleApiResponse(response);
};

export const deleteBlockData = async (chatbotId: string, blockId: string, token: string) => {
  const response = await adminApiClient.delete(`/chatbots/${chatbotId}/blocks/${blockId}`, token);
  return handleApiResponse(response);
};

export const processDocument = async (file: File, chatbotId: string, blockId: string, token: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('chatbotId', chatbotId);
  formData.append('blockId', blockId);

  const response = await adminApiClient.post('/process-document', formData, token);
  return handleApiResponse(response);
};

// Test datasets API
export interface TestDataset {
  id: string;
  name: string;
  chatbotId?: string;
  examples: Array<{ question: string; answer: string; expectedSources?: string[] }>;
  createdAt: string;
  updatedAt: string;
}

export const listTestDatasets = async (token: string, chatbotId?: string) => {
  const query = chatbotId ? `?chatbotId=${encodeURIComponent(chatbotId)}` : '';
  const response = await adminApiClient.get(`/test-datasets${query}`, token);
  return handleApiResponse(response) as Promise<TestDataset[]>;
};

export const createTestDataset = async (
  token: string,
  payload: { name: string; examples: Array<{ question: string; answer: string; expectedSources?: string[] }>; chatbotId?: string }
) => {
  const response = await adminApiClient.post('/test-datasets', payload, token);
  return handleApiResponse(response) as Promise<TestDataset>;
};

export const updateTestDataset = async (
  token: string,
  id: string,
  payload: { name: string; examples: Array<{ question: string; answer: string; expectedSources?: string[] }> }
) => {
  const response = await adminApiClient.put(`/test-datasets/${id}`, payload, token);
  return handleApiResponse(response) as Promise<TestDataset>;
};

export const deleteTestDataset = async (token: string, id: string) => {
  const response = await adminApiClient.delete(`/test-datasets/${id}`, token);
  return handleApiResponse(response) as Promise<boolean>;
};

export const importTestDatasetCsv = async (token: string, file: File, options?: { chatbotId?: string }) => {
  const formData = new FormData();
  formData.append('file', file);
  if (options?.chatbotId) {
    formData.append('chatbotId', options.chatbotId);
  }
  const response = await adminApiClient.post('/test-datasets/import', formData, token);
  return handleApiResponse(response);
};

export const downloadTestDatasetCsv = async (token: string, datasetId: string) => {
  const response = await adminApiClient.get(`/test-datasets/${datasetId}/export`, token);
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dataset-${datasetId}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export const downloadTestRunCsv = async (token: string, runId: string) => {
  const response = await adminApiClient.get(`/test-runs/${runId}/export`, token);
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `test-run-${runId}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

// API Token types
export interface ApiToken {
  id: string;
  name: string;
  token?: string; // Only present when creating
  tokenPrefix: string;
  tokenType: 'DURATION' | 'USAGE' | 'PERMANENT';
  expiresAt?: string | null;
  maxUsage?: number | null;
  currentUsage: number;
  isActive: boolean;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  blockId?: string | null;
  chatbotId: string;
}

export interface CreateApiTokenData {
  name: string;
  tokenType: 'DURATION' | 'USAGE' | 'PERMANENT';
  expiresAt?: string;
  maxUsage?: number;
  blockId?: string;
}

export interface UpdateApiTokenData {
  name?: string;
  expiresAt?: string | null;
  maxUsage?: number | null;
}

// API Token functions
export const createApiToken = async (chatbotId: string, data: CreateApiTokenData, token: string): Promise<ApiToken> => {
  const response = await adminApiClient.post(`/chatbots/${chatbotId}/api-tokens`, data, token);
  return handleApiResponse(response) as Promise<ApiToken>;
};

export const listApiTokens = async (chatbotId: string, token: string): Promise<ApiToken[]> => {
  const response = await adminApiClient.get(`/chatbots/${chatbotId}/api-tokens`, token);
  return handleApiResponse(response) as Promise<ApiToken[]>;
};

export const getApiToken = async (tokenId: string, token: string): Promise<ApiToken> => {
  const response = await adminApiClient.get(`/api-tokens/${tokenId}`, token);
  return handleApiResponse(response) as Promise<ApiToken>;
};

export const updateApiToken = async (tokenId: string, data: UpdateApiTokenData, token: string): Promise<ApiToken> => {
  const response = await adminApiClient.patch(`/api-tokens/${tokenId}`, data, token);
  return handleApiResponse(response) as Promise<ApiToken>;
};

export const revokeApiToken = async (tokenId: string, token: string): Promise<{ message: string }> => {
  const response = await adminApiClient.delete(`/api-tokens/${tokenId}`, token);
  return handleApiResponse(response) as Promise<{ message: string }>;
};

// Slack Integration types
export interface SlackIntegration {
  id: string;
  chatbotId: string;
  blockId: string | null;
  teamId: string;
  teamName: string;
  botUserId: string;
  botUserName: string;
  respondToMentions: boolean;
  respondInThreads: boolean;
  respondInDMs: boolean;
  respondInChannels: boolean;
  isActive: boolean;
  installedAt: string;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  installedBy: string;
}

export interface UpdateSlackIntegrationData {
  respondToMentions?: boolean;
  respondInThreads?: boolean;
  respondInDMs?: boolean;
  respondInChannels?: boolean;
}

export interface SlackCredentials {
  blockId: string;
  clientId: string;
  clientSecret: string;
  signingSecret: string;
}

// Slack Integration functions
export const saveSlackCredentials = async (
  chatbotId: string,
  credentials: SlackCredentials,
  token: string
): Promise<{ integration: SlackIntegration }> => {
  const response = await adminApiClient.post(`/chatbots/${chatbotId}/slack/integration/credentials`, credentials, token);
  return handleApiResponse(response) as Promise<{ integration: SlackIntegration }>;
};

export const getSlackIntegration = async (chatbotId: string, token: string): Promise<{ integration: SlackIntegration | null }> => {
  const response = await adminApiClient.get(`/chatbots/${chatbotId}/slack/integration`, token);
  return handleApiResponse(response) as Promise<{ integration: SlackIntegration | null }>;
};

export const startSlackOAuth = async (chatbotId: string, blockId: string, token: string): Promise<{ oauthUrl: string }> => {
  const response = await adminApiClient.get(`/slack/oauth/start?chatbotId=${chatbotId}&blockId=${blockId}`, token);
  return handleApiResponse(response) as Promise<{ oauthUrl: string }>;
};

export const updateSlackIntegration = async (
  chatbotId: string,
  data: UpdateSlackIntegrationData,
  token: string
): Promise<{ integration: SlackIntegration }> => {
  const response = await adminApiClient.patch(`/chatbots/${chatbotId}/slack/integration`, data, token);
  return handleApiResponse(response) as Promise<{ integration: SlackIntegration }>;
};

export const revokeSlackIntegration = async (chatbotId: string, token: string): Promise<{ success: boolean }> => {
  const response = await adminApiClient.delete(`/chatbots/${chatbotId}/slack/integration`, token);
  return handleApiResponse(response) as Promise<{ success: boolean }>;
};

// Cloud Storage Integration API functions
export interface CloudIntegration {
  provider?: 'nextcloud' | 'googledrive' | 'onedrive';
  baseUrl?: string;
  clientId?: string;
  hasClientSecret?: boolean; // Indicates if secret is set (not the actual secret)
  accountId?: string;
  accountName?: string;
  selectedPaths?: string[];
  fileTypeFilters?: string[];
  autoRefresh?: boolean;
  refreshInterval?: number;
  // Scheduled crawling (similar to WebsiteContext)
  cronEnabled?: boolean;
  cronSchedule?: string;
  cronTimezone?: string;
  nextCrawlAt?: string;
  lastIndexedAt?: string;
  indexedFileCount?: number;
  filesDiscovered?: number; // Number of files discovered during listing (for progress tracking)
  indexingStatus?: 'idle' | 'indexing' | 'completed' | 'error';
  indexingError?: string;
  isConnected?: boolean;
  connectedAt?: string;
  hasAccessToken?: boolean;
  hasRefreshToken?: boolean;
}

export const startCloudOAuth = async (
  provider: string,
  chatbotId: string,
  blockId: string,
  token: string
): Promise<{ oauthUrl: string }> => {
  const response = await adminApiClient.get(
    `/cloud/oauth/start?provider=${encodeURIComponent(provider)}&chatbotId=${encodeURIComponent(chatbotId)}&blockId=${encodeURIComponent(blockId)}`,
    token
  );
  return handleApiResponse(response) as Promise<{ oauthUrl: string }>;
};

export const getCloudIntegration = async (
  blockId: string,
  token: string
): Promise<{ integration: CloudIntegration }> => {
  const response = await adminApiClient.get(`/cloud/integration/${blockId}`, token);
  return handleApiResponse(response) as Promise<{ integration: CloudIntegration }>;
};

export const updateCloudIntegration = async (
  blockId: string,
  updates: Partial<CloudIntegration>,
  token: string
): Promise<{ success: boolean; block: { id: string; properties: Record<string, unknown> } }> => {
  const response = await adminApiClient.put(`/cloud/integration/${blockId}`, updates, token);
  return handleApiResponse(response) as Promise<{ success: boolean; block: { id: string; properties: Record<string, unknown> } }>;
};

export const testCloudConnection = async (
  blockId: string,
  token: string
): Promise<{ connected: boolean }> => {
  const response = await adminApiClient.post(`/cloud/integration/${blockId}/test`, {}, token);
  return handleApiResponse(response) as Promise<{ connected: boolean }>;
};

export const disconnectCloudIntegration = async (
  blockId: string,
  token: string
): Promise<{ success: boolean }> => {
  const response = await adminApiClient.delete(`/cloud/integration/${blockId}`, token);
  return handleApiResponse(response) as Promise<{ success: boolean }>;
};

export const triggerCloudIndexing = async (
  blockId: string,
  token: string
): Promise<{ success: boolean; message: string }> => {
  const response = await adminApiClient.post(`/cloud/integration/${blockId}/index`, {}, token);
  return handleApiResponse(response) as Promise<{ success: boolean; message: string }>;
};

export const cancelCloudIndexing = async (
  blockId: string,
  token: string
): Promise<{ success: boolean; message: string }> => {
  const response = await adminApiClient.post(`/cloud/integration/${blockId}/index/cancel`, {}, token);
  return handleApiResponse(response) as Promise<{ success: boolean; message: string }>;
};

export const listCloudFolders = async (
  blockId: string,
  path: string,
  token: string
): Promise<{ folders: Array<{ path: string; name: string }> }> => {
  const response = await adminApiClient.get(`/cloud/integration/${blockId}/folders?path=${encodeURIComponent(path)}`, token);
  return handleApiResponse(response) as Promise<{ folders: Array<{ path: string; name: string }> }>;
};

export interface FolderTreeNode {
  path: string;
  name: string;
  children: FolderTreeNode[];
}

export const listCloudFolderTree = async (
  blockId: string,
  maxDepth: number,
  token: string
): Promise<{ tree: FolderTreeNode[] }> => {
  const response = await adminApiClient.get(`/cloud/integration/${blockId}/folders/tree?maxDepth=${maxDepth}`, token);
  return handleApiResponse(response) as Promise<{ tree: FolderTreeNode[] }>;
};

export const listCloudFiles = async (
  blockId: string,
  folderId: string | undefined,
  path: string | undefined,
  token: string
): Promise<{ folders: Array<{ id: string; name: string; path: string }>; files: Array<{ id: string; name: string; path: string; mimeType?: string; size?: number }> }> => {
  // Build query string - use folderId for Google Drive, path for Nextcloud
  const params = new URLSearchParams();
  if (folderId) {
    params.append('folderId', folderId);
  }
  if (path !== undefined) {
    params.append('path', path);
  }
  const queryString = params.toString();
  const response = await adminApiClient.get(`/cloud/integration/${blockId}/files${queryString ? `?${queryString}` : ''}`, token);
  return handleApiResponse(response) as Promise<{ folders: Array<{ id: string; name: string; path: string }>; files: Array<{ id: string; name: string; path: string; mimeType?: string; size?: number }> }>;
};

export const listSharedFolders = async (
  blockId: string,
  token: string
): Promise<{ folders: Array<{ id: string; name: string; path: string }> }> => {
  const response = await adminApiClient.get(`/cloud/integration/${blockId}/shared-folders`, token);
  return handleApiResponse(response) as Promise<{ folders: Array<{ id: string; name: string; path: string }> }>;
};

// Custom Provider API functions
export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  modelName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderAvailability {
  gemini: boolean;
  openai: boolean;
  anthropic: boolean;
  mistral: boolean;
  custom: boolean;
}

export const getProviderAvailability = async (token: string): Promise<ProviderAvailability> => {
  const response = await adminApiClient.get('/providers/availability', token);
  return handleApiResponse(response) as Promise<ProviderAvailability>;
};

export const listCustomProviders = async (token: string): Promise<CustomProvider[]> => {
  const response = await adminApiClient.get('/custom-providers', token);
  return handleApiResponse(response) as Promise<CustomProvider[]>;
};

export const getCustomProvider = async (id: string, token: string): Promise<CustomProvider> => {
  const response = await adminApiClient.get(`/custom-providers/${id}`, token);
  return handleApiResponse(response) as Promise<CustomProvider>;
};

export const createCustomProvider = async (
  data: { name: string; baseUrl: string; apiToken: string; modelName: string },
  token: string
): Promise<CustomProvider> => {
  const response = await adminApiClient.post('/custom-providers', data, token);
  return handleApiResponse(response) as Promise<CustomProvider>;
};

export const updateCustomProvider = async (
  id: string,
  data: Partial<{ name: string; baseUrl: string; apiToken: string; modelName: string }>,
  token: string
): Promise<CustomProvider> => {
  const response = await adminApiClient.put(`/custom-providers/${id}`, data, token);
  return handleApiResponse(response) as Promise<CustomProvider>;
};

export const deleteCustomProvider = async (id: string, token: string): Promise<void> => {
  const response = await adminApiClient.delete(`/custom-providers/${id}`, token);
  return handleApiResponse(response) as Promise<void>;
};

export const testCustomProvider = async (
  id: string,
  token: string
): Promise<{ success: boolean; message?: string; error?: string; response?: string }> => {
  const response = await adminApiClient.post(`/custom-providers/${id}/test`, undefined, token);
  return handleApiResponse(response) as Promise<{ success: boolean; message?: string; error?: string; response?: string }>;
};

// Dashboard stats
export interface DashboardStats {
  totalChatbots: number;
  totalConversations: number;
  totalMessages: number;
  period?: string;
}

export type StatsPeriod = 'week' | 'month' | 'year' | 'global';

export const getDashboardStats = async (token: string, period: StatsPeriod = 'global'): Promise<DashboardStats> => {
  const response = await adminApiClient.get(`/dashboard/stats?period=${period}`, token);
  return handleApiResponse(response) as Promise<DashboardStats>;
};

