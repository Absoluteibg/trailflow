# Running Trailflow with Docker

Trailflow can be easily deployed using Docker and Docker Compose. This setup includes the Trailflow gateway and an Ollama service for local AI processing.

## Prerequisites

- Docker installed
- Docker Compose installed

## Setup Instructions

1. **Configure Environment Variables**
   Create a `.env` file in the root directory (refer to `.env.example`):
   ```env
   TELEGRAM_BOT_TOKEN=your_token_here
   ALLOWED_TELEGRAM_USER_IDS=12345678,87654321
   ```

2. **Start the Services**
   Run the following command to build and start the containers:
   ```bash
   docker-compose up -d
   ```

3. **Pull the AI Model**
   Once the containers are running, you need to pull the specific model requested into the Ollama container:
   ```bash
   docker exec -it trailflow-ollama-1 ollama pull ollama/gemma4:e4b
   ```
   *Note: Replace `trailflow-ollama-1` with your actual container name if different.*

4. **Access the Application**
   - Web UI: http://localhost:3000
   - Telegram Bot: Start interacting with your configured bot.

## Volumes

- `/app/workspace`: Persists the agent's workspace files.
- `/app/data`: Persists the SQLite database for sessions and messages.
- `/root/.ollama`: Persists downloaded AI models within the Ollama container.
