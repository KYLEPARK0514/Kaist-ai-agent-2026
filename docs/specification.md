# KAIST AI Agent Specification

## Overview
This project aims to build an AI chatbot agent that allows users to upload PDF files to create a knowledge base. The system will use this knowledge base to answer user questions. The chatbot agent will be deployed on Microsoft Azure, with plans to integrate Google's Gemini-3-Pro LLM from Google Cloud Platform (GCP) in the future.

## System Architecture
The system consists of three main components:
1. **Client**: A web application for user interaction (PDF upload and chat interface).
2. **API Server**: A backend service to handle PDF processing, knowledge base creation, and chatbot responses.
3. **Infrastructure**: Cloud resources on Azure for storage, database, and deployment.

### Data Flow
1. User uploads PDF files via the web client.
2. PDFs are stored in Azure Blob Storage.
3. API server processes PDFs to extract text and create vector embeddings for the knowledge base.
4. Knowledge base is stored in Azure Cosmos DB with hybrid search capabilities (full-text + vector search).
5. User asks questions through the chat interface.
6. API server queries the knowledge base and generates responses (initially rule-based, later with LLM integration).

## Infrastructure
- **Cloud Provider**: Microsoft Azure
- **Region**: koreacentral
- **Deployment Tool**: Azure Developer CLI (azd)
- **Infrastructure as Code**: Bicep templates
- **Resource Group**: kaist-ai-agent-rg

### Resources
- **Azure Cosmos DB**: 
  - Mode: Serverless
  - Features: Hybrid search (full-text search + vector search)
  - Purpose: Store knowledge base data, embeddings, and metadata
- **Azure Blob Storage**:
  - Purpose: Store uploaded PDF files
- **Azure Functions**:
  - Runtime: Python 3.11
  - Purpose: Host the API server
- **Azure Static Web Apps**:
  - Purpose: Host the client web application
- **LLM Integration** (Future):
  - Provider: Google Cloud Platform (GCP)
  - Model: Gemini-3-Pro

## API Server
- **Runtime**: Python 3.11
- **Deployment**: Azure Functions
- **Responsibilities**:
  - Handle PDF upload and processing
  - Extract text from PDFs
  - Generate vector embeddings for knowledge base
  - Store data in Cosmos DB
  - Process user queries and generate responses
  - Integrate with LLM (future)

### Key Technologies
- PDF processing: PyPDF2 or similar
- Vector embeddings: OpenAI embeddings or similar (initially), later GCP
- Database operations: Azure Cosmos DB SDK
- Authentication: Azure AD (if needed)

## Client
- **Framework**: React + Vite + TypeScript
- **Styling**: Tailwind CSS
- **Deployment**: Azure Static Web Apps
- **Features**:
  - PDF upload interface
  - Chat interface for Q&A
  - Responsive design
  - Real-time updates (if applicable)

### Key Technologies
- React for UI components
- Vite for build tooling
- TypeScript for type safety
- Tailwind CSS for styling
- Axios or Fetch for API calls

## Deployment
- Use `azd` command for deployment and management
- Infrastructure deployed via Bicep templates
- CI/CD pipelines for automated deployment (optional)

## Security Considerations
- Secure PDF storage in Blob Storage
- Authentication for API access
- Data encryption at rest and in transit
- Compliance with data protection regulations

## Future Enhancements
- Integrate GCP Gemini-3-Pro for advanced LLM responses
- Add user authentication and multi-tenancy
- Implement advanced PDF parsing (OCR for images)
- Add analytics and monitoring
- Support for additional file types

## Development Guidelines
- Follow Azure best practices for resource management
- Use environment variables for configuration
- Implement proper error handling and logging
- Write unit tests for critical components
- Document APIs and code changes

## Team Responsibilities
- Infrastructure: Azure resource setup and management
- Backend: API server development and LLM integration
- Frontend: Client application development
- DevOps: Deployment automation and monitoring