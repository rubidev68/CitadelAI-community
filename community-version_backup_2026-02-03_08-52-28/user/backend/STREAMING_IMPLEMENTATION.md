# Streaming Implementation

This document describes the real-time streaming implementation for chatbot responses using Gemini API.

## Overview

The streaming implementation provides real-time responses from the Gemini API to the frontend, creating a more engaging user experience by showing text appearing progressively as it's generated, rather than waiting for the complete response.

## Architecture

### Backend Components

1. **Gemini Service** (`src/services/gemini.ts`)
   - `generateStreamingResponse()`: Handles real-time streaming responses from Gemini API
   - Uses Server-Sent Events (SSE) to stream data to the client
   - Implements native Gemini streaming with `sendMessageStream()`

2. **Chat Controller** (`src/controllers/chat.ts`)
   - `respondStreaming()`: Streaming endpoint for real-time responses
   - Handles authentication, session management, and context retrieval
   - Streams responses using SSE

3. **Routes** (`src/routes/chat.ts`)
   - `POST /api/chat/respond-streaming`: Streaming endpoint

### Frontend Components

1. **API Configuration** (`src/config/api.ts`)
   - `RESPOND_STREAMING` endpoint configuration

2. **Chat Interface** (`src/components/chat/ChatInterface.tsx`)
   - Real-time streaming with "thinking" placeholder
   - SSE data parsing and progressive UI updates
   - Automatic fallback to regular endpoint if streaming fails

## Data Flow

```
User Input → Frontend → Backend Streaming Endpoint → Gemini API (Real-time Stream) → SSE Stream → Frontend → Progressive UI Update
```

## SSE Event Types

- `metadata`: Session information and chat session ID
- `chunk`: Real-time text chunks from Gemini
- `complete`: Final response completion
- `error`: Error handling

## Implementation Details

### Backend Streaming

- **Native Gemini Streaming**: Uses `chat.sendMessageStream()` for true real-time streaming
- **SSE Protocol**: Implements Server-Sent Events for efficient real-time communication
- **Error Handling**: Comprehensive error handling with proper header management
- **Context Integration**: Includes Weaviate context and system prompts

### Frontend Streaming

- **Progressive Display**: Shows "thinking" placeholder until first chunk arrives
- **Real-time Updates**: Updates message content as chunks are received
- **Fallback Mechanism**: Automatically falls back to regular endpoint if streaming fails
- **Visual Feedback**: Provides loading states and error handling

## Package Dependencies

- **Google Generative AI**: `@google/generative-ai@^0.21.0`
- **Native Streaming**: Uses `sendMessageStream()` method for real-time responses

## User Experience

1. **Immediate Feedback**: "Thinking" placeholder appears instantly
2. **Progressive Response**: Text appears word by word as Gemini generates it
3. **Natural Flow**: Real-time streaming at Gemini's actual generation speed
4. **Reliable Fallback**: Seamless fallback to regular responses if needed

## Testing

### Manual Testing
1. Start backend services
2. Open frontend chat interface
3. Send a message and observe real-time streaming
4. Test fallback by disabling streaming endpoint

### Automated Testing
- Backend streaming endpoint tests
- Frontend SSE parsing tests
- Error handling and fallback tests

## Error Handling

- **Backend**: SSE error events with proper HTTP status codes
- **Frontend**: Graceful fallback to regular endpoint
- **User Feedback**: Toast notifications for errors
- **Logging**: Comprehensive error logging without sensitive data

## Performance

- **Real-time**: No artificial delays - streams at Gemini's generation speed
- **Efficient**: Uses native streaming for optimal performance
- **Responsive**: Immediate user feedback with progressive updates
- **Reliable**: Robust error handling and fallback mechanisms