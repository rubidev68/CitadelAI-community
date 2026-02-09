# CitadelAI Community Edition

CitadelAI Community Edition is an open-source, AI-powered chatbot platform that allows you to create, manage, and deploy intelligent agents with ease.

## 🚀 Features

*   **Visual Block Editor:** Drag-and-drop interface to build chatbot logic.
*   **Multi-Model Support:** Connect with OpenAI, Anthropic, Gemini, and Mistral.
*   **Web Crawling:** Built-in crawler to ingest website content for RAG.
*   **Role-Based Access:** Standard user and admin management.
*   **Open Source:** Self-hosted and free to use.

## 🛠 Prerequisites

*   Docker & Docker Compose
*   Git

## 🏁 Quick Start

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/rubidev68/citadelai-community.git
    cd citadelai-community
    ```

2.  **Configure environment:**
    ```bash
    cp .env.example .env
    # Edit .env to add your AI API keys and change secrets
    ```

3.  **Start the platform (using pre-built images):**
    ```bash
    docker-compose up -d
    ```

    **Or build from source (dev mode):**
    ```bash
    docker-compose -f docker-compose.dev.yml up -d --build
    ```

4.  **Access the interfaces:**
    *   **Admin Dashboard:** http://localhost:3000
    *   **User Chat Interface:** http://localhost:4000

## 📚 Documentation

For full documentation, visit [docs.citadelai.app](https://docs.citadelai.app).

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📄 License

Apache 2.0
