# Document Processing System

## Overview

The Document Processing System enables users to upload PDF documents that are automatically converted to markdown, vectorized, and integrated into chatbot context. This allows chatbots to provide context-aware responses based on both website content and uploaded documents.

## Architecture

### Frontend Components

#### DocumentContextProperties Component
- **Location**: `admin/interface/src/components/properties/DocumentContextProperties.tsx`
- **Purpose**: Provides drag-and-drop file upload interface for document context blocks
- **Features**:
  - Drag and drop PDF upload
  - File validation (PDF only, max 10MB)
  - Real-time processing status indicators
  - File list management with delete functionality
  - Loading animations and progress tracking

#### Key Features
- **Drag & Drop Interface**: Users can drag PDF files directly onto the upload area
- **File Validation**: Only PDF files are accepted with a 10MB size limit
- **Processing Status**: Real-time status updates (uploading, processing, completed, error)
- **Progress Indicators**: Visual progress bars and loading animations
- **File Management**: View uploaded files with individual status and delete options

### Backend API

#### Document Processing Endpoint
- **Route**: `POST /api/admin/process-document`
- **Location**: `admin/backend/src/routes/documents.ts`
- **Authentication**: Requires admin authentication token
- **File Upload**: Uses multer for file handling with 10MB limit

#### Processing Pipeline
1. **File Validation**: Validates PDF file type and size
2. **PDF Parsing**: Uses `pdf-parse` library to extract text content
3. **Markdown Conversion**: Converts extracted text to markdown format
4. **Content Chunking**: Splits content into manageable chunks (max 1000 characters)
5. **Vectorization**: Stores chunks in Weaviate with auto-vectorization
6. **Response**: Returns markdown content and vector metadata

#### Error Handling
- **File Type Validation**: Rejects non-PDF files
- **Size Validation**: Rejects files larger than 10MB
- **PDF Parsing Errors**: Handles corrupted or invalid PDF files
- **Vectorization Errors**: Graceful handling of Weaviate connection issues
- **Network Errors**: Comprehensive error handling for API failures

### Vector Database Integration

#### Weaviate Schema
- **Class Name**: `DocumentContent`
- **Vectorizer**: `text2vec-openai`
- **Properties**:
  - `chatbotId`: String - Links content to specific chatbot
  - `blockId`: String - Links content to specific document block
  - `content`: Text - The actual document content chunk
  - `type`: String - Always "document"
  - `chunkIndex`: Integer - Position of chunk in document
  - `totalChunks`: Integer - Total number of chunks in document
  - `processedAt`: Date - Timestamp of processing
  - `chunkType`: String - Type of chunk (paragraph, heading, list, code, mixed)
  - `parentHeading`: String - Parent heading context
  - `wordCount`: Integer - Word count for analysis
  - `charCount`: Integer - Character count
  - `semanticScore`: Number - Similarity score for merged chunks

#### Content Chunking Strategy
- **Semantic Chunking**: Intelligent boundary detection based on content structure
- **Adaptive Sizing**: 1500-1800 characters optimized for document content
- **Structure Awareness**: Respects headings, paragraphs, lists, and code blocks
- **Semantic Similarity**: Merges related content and preserves topic boundaries
- **Context Preservation**: Overlap between chunks maintains coherence
- **Rich Metadata**: Enhanced metadata including chunk type, parent heading, and semantic scores

### Context Retrieval

#### Enhanced Chat Controller
- **Location**: `user/backend/src/controllers/chat.ts`
- **Function**: Both `respond` and `respondStreaming` functions updated
- **Context Sources**: Now retrieves from both `WebsiteContent` and `DocumentContent`

#### Context Retrieval Process
1. **Website Content**: Retrieves up to 2 most relevant website content chunks
2. **Document Content**: Retrieves up to 2 most relevant document content chunks
3. **Context Combination**: Merges both sources into unified context
4. **Response Generation**: Uses combined context for AI response generation

#### Query Strategy
- **Semantic Search**: Uses Weaviate's `withNearText` for semantic similarity
- **Chatbot Filtering**: Only retrieves content for the specific chatbot
- **Limit Control**: Retrieves limited number of chunks for optimal performance
- **Error Handling**: Graceful fallback if document content retrieval fails

## User Experience

### Upload Process
1. **Drag & Drop**: User drags PDF file onto upload area
2. **Validation**: System validates file type and size
3. **Processing**: Shows loading animation with status updates
4. **Completion**: File appears in list with "Ready" status
5. **Error Handling**: Clear error messages for any issues

### Status Indicators
- **Uploading**: File is being uploaded to server
- **Processing**: PDF is being converted and vectorized
- **Completed**: File is ready and available for context
- **Error**: Processing failed with specific error message

### File Management
- **File List**: Shows all uploaded files with status
- **Delete Function**: Remove files with confirmation
- **Progress Tracking**: Overall progress across multiple files
- **Status Summary**: Shows completion count and processing status

## Technical Implementation

### Dependencies
- **Frontend**: React, TypeScript, Tailwind CSS, Lucide React icons
- **Backend**: Express.js, multer, pdf-parse, weaviate-ts-client
- **File Processing**: pdf-parse for PDF text extraction
- **Vector Database**: Weaviate for semantic search and storage

### API Integration
- **Admin Backend**: Handles file upload and processing
- **User Backend**: Retrieves context for chat responses
- **Weaviate**: Stores and retrieves vectorized content
- **Authentication**: Admin token required for document processing

### Error Handling
- **Client-Side**: File validation, loading states, error messages
- **Server-Side**: PDF parsing errors, Weaviate connection issues
- **Network**: API timeout handling, connection failures
- **User Feedback**: Clear error messages and recovery options

## Configuration

### File Limits
- **Maximum File Size**: 10MB per PDF
- **Supported Formats**: PDF only (extensible to other formats)
- **Chunk Size**: 1500-1800 characters with semantic boundary detection
- **Context Limit**: 2 chunks each from website and document content

### Weaviate Configuration
- **Vectorizer**: text2vec-openai for semantic understanding
- **Chunking**: Semantic chunking with structure awareness
- **Indexing**: Automatic vector generation and indexing
- **Querying**: Semantic similarity search with chatbot filtering

## Future Enhancements

### Planned Features
- **Multiple File Formats**: Support for DOC, TXT, and other text formats
- **Batch Processing**: Upload and process multiple files simultaneously
- **Advanced Chunking**: Enhanced semantic chunking with domain-specific strategies
- **Content Preview**: Show document content preview before processing
- **Version Control**: Track document updates and changes
- **Search Interface**: Search within uploaded documents

### Performance Optimizations
- **Async Processing**: Background processing for large documents
- **Caching**: Cache processed content for faster retrieval
- **Compression**: Optimize storage for large document collections
- **Indexing**: Advanced indexing strategies for better search performance

## Troubleshooting

### Common Issues
1. **File Upload Fails**: Check file size (max 10MB) and format (PDF only)
2. **Processing Stuck**: Verify Weaviate connection and PDF file integrity
3. **Context Not Retrieved**: Check chatbot ID and document processing status
4. **Slow Processing**: Large PDFs may take longer to process and vectorize

### Debug Information
- **Console Logs**: Check browser console for client-side errors
- **Server Logs**: Check admin backend logs for processing errors
- **Weaviate Status**: Verify vector database connection and schema
- **File Validation**: Ensure PDF files are not corrupted or password-protected

## Security Considerations

### File Security
- **File Validation**: Strict file type and size validation
- **Virus Scanning**: Consider adding virus scanning for uploaded files
- **Access Control**: Only authenticated admin users can upload documents
- **Data Isolation**: Documents are isolated per chatbot and user

### Data Privacy
- **Content Storage**: Document content is stored in vector database
- **Access Control**: Only chatbot owners can access their documents
- **Data Retention**: Consider implementing document retention policies
- **Encryption**: Ensure secure transmission and storage of document content
