# Docker Setup

This application is containerized with Docker and Docker Compose for easy local development and deployment.

## Prerequisites

- Docker and Docker Compose installed
- `COSMOS_CONNECTION_STRING` environment variable set (from Azure)

## Quick Start

### 1. Set up environment variables

Create a `.env.docker` file in the project root:

```bash
COSMOS_CONNECTION_STRING=your-cosmos-db-connection-string
```

### 2. Build and run

```bash
docker-compose up --build
```

If you want to push container images to Azure Container Registry instead of using GitHub Actions, use:

```bash
chmod +x scripts/push-to-acr.sh
./scripts/push-to-acr.sh
```

This path works even when you do not own the source repo.

This will:
- Build and start the Azure Functions API on port 7071
- Build and start the Vite frontend (served by Nginx) on port 80

### 3. Access the app

Open your browser to `http://localhost`

The Nginx reverse proxy automatically routes:
- `/`  → React app (static files)
- `/api/*` → Azure Functions (port 7071)

## Development

For local development without Docker:

```bash
# Terminal 1: Start the API
func start --script-root api --port 7071

# Terminal 2: Start the frontend dev server
npm run dev
```

## Production Build

The `Dockerfile` uses a multi-stage build:
1. **Builder stage** — Install deps, build Vite frontend to `/app/dist`
2. **Production stage** — Serve the dist folder via lightweight Nginx image

The API container uses the official Azure Functions base image.

## Manual Docker Build

If you prefer to build images separately:

```bash
# Frontend
docker build -t apex-app:latest .

# API
docker build -t apex-api:latest ./api
```

Then run with custom networking:

```bash
docker run -d --name apex-api apex-api:latest
docker run -d --name apex-app -p 80:80 --link apex-api:api apex-app:latest
```

## Troubleshooting

- **API container fails to start**: Make sure `COSMOS_CONNECTION_STRING` is set in your environment or `.env.docker`
- **Frontend can't reach API**: Check that Nginx is routing to `http://api:7071/api/` (the service name `api` must match in docker-compose)
- **Port 80 already in use**: Change `docker-compose.yml` line `- "80:80"` to `- "8080:80"`

## Structure

```
Dockerfile              — multi-stage build for React frontend
api/Dockerfile          — Azure Functions runtime image
nginx.conf              — Nginx reverse proxy config
docker-compose.yml      — local dev orchestration
.dockerignore           — exclude files from build context
api/.dockerignore       — same for API container
```
