# Contributing to CitadelAI

We welcome contributions to CitadelAI! Whether you're fixing bugs, improving documentation, or proposing new features, your efforts are appreciated.

## Getting Started

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** locally.
    ```bash
    git clone https://github.com/your-username/CitadelAI.git
    cd CitadelAI
    ```
3.  **Install dependencies**:
    ```bash
    npm install
    ```
4.  **Create a branch** for your feature or fix.
    ```bash
    git checkout -b feature/my-new-feature
    ```

## Development Workflow

-   **Backend**: Node.js with Express and TypeScript.
-   **Frontend**: React with TypeScript.
-   **Database**: PostgreSQL and Weaviate.

Use `docker-compose` to spin up the required services (database, vector db, etc.):
```bash
docker-compose up db weaviate -d
```

Run the development server:
```bash
npm run dev
```

## Testing

Please ensure your changes pass existing tests and add new tests for new functionality.

```bash
npm test
```

## Linting & Formatting

We use ESLint and Prettier. Run the linter before committing:

```bash
npm run lint
```

## Pull Requests

1.  Push your branch to your fork.
2.  Open a Pull Request against the `main` branch (or `opensource-dev` for community features).
3.  Describe your changes and link any relevant issues.

## Code of Conduct

Please treat everyone with respect and follow our Code of Conduct.
