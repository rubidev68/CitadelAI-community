# API Reference (Community Edition)

This document provides API documentation for the CitadelAI Community Edition.

## Base URLs

- **User Service**: `http://localhost:3003/api`
- **Admin Service**: `http://localhost:3002/api`
- **Crawling Service**: `http://localhost:3001`
- **Cron Scheduler Service**: `http://localhost:3004`

## Authentication

All API endpoints require authentication via JWT tokens in the Authorization header:

```bash
Authorization: Bearer <your-jwt-token>
```

## User Service API (Port 3003)

### Authentication Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Chat Endpoints

- `POST /api/chat/respond` - Send message
- `POST /api/chat/respond-streaming` - Send message (streaming)
- `GET /api/chat/history` - Get chat history
- `GET /api/chat/sessions` - Get chat sessions
- `POST /api/chat/sessions` - Create chat session
- `DELETE /api/chat/:id` - Delete chat session

### Chatbot Endpoints

- `GET /api/chatbots` - List accessible chatbots
- `GET /api/chatbots/:id` - Get specific chatbot

## Admin Service API (Port 3002)

### Authentication Endpoints

- `POST /api/admin/auth/register` - Admin registration
- `POST /api/admin/auth/login` - Admin login
- `GET /api/admin/me` - Get current admin

### Chatbot Management

- `POST /api/admin/chatbots` - Create chatbot
- `GET /api/admin/chatbots` - List chatbots
- `GET /api/admin/chatbots/:id` - Get chatbot
- `PUT /api/admin/chatbots/:id` - Update chatbot
- `DELETE /api/admin/chatbots/:id` - Delete chatbot

### Crawling Management

- `POST /api/admin/crawl` - Start crawling job
- `GET /api/admin/status/:blockId` - Get crawling status
- `POST /api/admin/stop` - Stop crawling job
- `POST /api/admin/cron/update` - Update cron settings

## Crawling Service API (Port 3001)

- `POST /crawl` - Start optimized crawling job
- `GET /status/:blockId` - Get crawling status
- `POST /stop` - Stop crawling job
- `GET /health` - Health check

## Cron Scheduler Service API (Port 3004)

- `POST /cron/update` - Update cron settings
- `GET /cron/status/:blockId` - Get cron status
- `GET /cron/scheduled` - List scheduled crawls
- `DELETE /cron/unschedule/:blockId` - Unschedule task

## Error Handling

Standardized error response format:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

---
*This API reference reflects the Community Edition.*
