/**
 * Centralized service registry for internal service URLs.
 * Uses environment variables with safe defaults and keeps
 * existing behavior unchanged.
 */

export type ServiceName =
  | 'crawling-service'
  | 'cron-scheduler'
  | 'email-service'
  | 'user-backend'
  | 'admin-backend'
  | 'superadmin-backend';

/**
 * Get the base URL for an internal service.
 *
 * NOTE: Defaults are chosen to match existing usages in the codebase
 * (docker-compose, routes, and services) to avoid breaking behavior.
 *
 * @param serviceName - The name of the service
 * @returns The base URL for the service
 */
export function getServiceBaseUrl(serviceName: ServiceName): string {
  switch (serviceName) {
    case 'crawling-service':
      // Matches existing defaults like CRAWLING_SERVICE_URL || 'http://crawling-service:3001'
      return process.env.CRAWLING_SERVICE_URL || 'http://crawling-service:3001';

    case 'cron-scheduler':
      // Matches existing defaults like CRON_SCHEDULER_URL || 'http://cron-scheduler:3002'
      // Note: docker-compose uses port 3002 for cron-scheduler
      return process.env.CRON_SCHEDULER_URL || 'http://cron-scheduler:3002';

    case 'email-service':
      // Matches EMAIL_SERVICE_URL || 'http://email-service:3008'
      return process.env.EMAIL_SERVICE_URL || 'http://email-service:3008';

    case 'user-backend':
      // Matches USER_BACKEND_URL || 'http://user-backend:3003'
      return process.env.USER_BACKEND_URL || 'http://user-backend:3003';

    case 'admin-backend':
      // Matches ADMIN_BACKEND_URL || 'http://admin-backend:3002' in docker configs
      return process.env.ADMIN_BACKEND_URL || 'http://admin-backend:3002';

    case 'superadmin-backend':
      // Matches SUPERADMIN_BACKEND_URL || 'http://superadmin-dashboard-backend:3007'
      return process.env.SUPERADMIN_BACKEND_URL || 'http://superadmin-dashboard-backend:3007';

    default:
      throw new Error(`Unknown service name: ${serviceName}`);
  }
}
