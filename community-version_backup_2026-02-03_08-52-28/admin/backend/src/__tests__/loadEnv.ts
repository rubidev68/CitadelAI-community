import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Load environment variables from prod.env file if it exists
 * Falls back to test defaults if file doesn't exist
 */
export function loadProdEnv(): void {
  try {
    // Try to load from project root prod.env
    // Use process.cwd() which should be the project root when running tests
    // Fallback to relative path from __dirname if cwd is different
    let prodEnvPath: string;
    const cwdPath = join(process.cwd(), 'prod.env');
    const relativePath = join(__dirname, '../../../../prod.env');
    
    // Try cwd first, then relative path
    try {
      readFileSync(cwdPath, 'utf-8');
      prodEnvPath = cwdPath;
    } catch {
      try {
        readFileSync(relativePath, 'utf-8');
        prodEnvPath = relativePath;
      } catch {
        // File doesn't exist in either location
        return;
      }
    }
    
    const envContent = readFileSync(prodEnvPath, 'utf-8');
    
    // Parse the env file (simple key=value parser)
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      
      // Parse key=value pairs
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        // Only set if not already set (allow override)
        // Exception: Never override JWT_SECRET in test environment to ensure test predictability
        if (key === 'JWT_SECRET' && process.env.NODE_ENV === 'test') {
          // Don't override JWT_SECRET in tests - keep test value
          continue;
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch (error) {
    // File doesn't exist or can't be read - use test defaults
    // This is expected in CI/CD or when prod.env is not available
  }
}
