export interface MigrationConfig {
  service: string;
  type: 'prisma' | 'sql';
  path: string;
  order: number;
  dependsOn?: string[];
  files?: string[]; // For SQL migrations
}

export interface MigrationResult {
  service: string;
  success: boolean;
  appliedMigrations?: string[];
  error?: string;
  duration?: number;
}

export interface MigrationStatus {
  completed: boolean;
  results: MigrationResult[];
  totalDuration: number;
  errors: string[];
}
