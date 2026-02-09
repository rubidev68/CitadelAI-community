/**
 * Determines the business website URL based on the current environment
 * @returns The business website URL (localhost:8083 for development, citadelai.app for production)
 */
export const getBusinessWebsiteUrl = (): string => {
  // Check if we're in development mode
  if (import.meta.env.DEV) {
    return 'http://localhost:8083';
  }
  
  // For production, use the main domain
  return 'https://citadelai.app';
};

/**
 * Gets the Terms of Service URL on the business website
 * @returns The Terms of Service URL
 */
export const getTermsOfServiceUrl = (): string => {
  return `${getBusinessWebsiteUrl()}/terms`;
};

/**
 * Gets the Privacy Policy URL on the business website
 * @returns The Privacy Policy URL
 */
export const getPrivacyPolicyUrl = (): string => {
  return `${getBusinessWebsiteUrl()}/privacy`;
};
