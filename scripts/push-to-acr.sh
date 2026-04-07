#!/bin/bash

# Build Docker images locally and push them to Azure Container Registry.
# This is the recommended path if you do not own the GitHub repository.

set -e

echo "🐳 Build and push Docker images to Azure Container Registry"
echo "=============================================="

if ! command -v az &> /dev/null; then
  echo "❌ Azure CLI not found. Install: https://learn.microsoft.com/cli/azure/install-azure-cli"
  exit 1
fi

if ! command -v docker &> /dev/null; then
  echo "❌ Docker not found. Install: https://docs.docker.com/get-docker/"
  exit 1
fi

RESOURCE_GROUP="rg-apex-basket-vm"
ACR_NAME=$(az acr list --resource-group "$RESOURCE_GROUP" --query "[0].name" -o tsv 2>/dev/null)
ACR_LOGIN_SERVER=$(az acr list --resource-group "$RESOURCE_GROUP" --query "[0].loginServer" -o tsv 2>/dev/null)

if [ -z "$ACR_NAME" ] || [ -z "$ACR_LOGIN_SERVER" ]; then
  echo "❌ No Azure Container Registry found in resource group '$RESOURCE_GROUP'"
  echo "   Run ./scripts/deploy.sh first to provision infrastructure, or set RESOURCE_GROUP to the correct RG."
  exit 1
fi

echo "✓ Found ACR: $ACR_LOGIN_SERVER"

echo "🔐 Logging in to Azure Container Registry..."
az acr login --name "$ACR_NAME"

echo "🔨 Building frontend image..."
docker build -t "$ACR_LOGIN_SERVER/apex-app:latest" .

echo "🔨 Building API image..."
docker build -t "$ACR_LOGIN_SERVER/apex-api:latest" ./api

echo "📤 Pushing frontend image..."
docker push "$ACR_LOGIN_SERVER/apex-app:latest"

echo "📤 Pushing API image..."
docker push "$ACR_LOGIN_SERVER/apex-api:latest"

echo ""
echo "✅ Images pushed to ACR:"
echo "   $ACR_LOGIN_SERVER/apex-app:latest"
echo "   $ACR_LOGIN_SERVER/apex-api:latest"
echo ""
echo "Next steps:"
echo "  1. SSH to your VM or Azure host"
echo "  2. Update docker-compose.yml to reference the ACR image names"
echo "  3. Set COSMOS_CONNECTION_STRING in the environment on the host"
echo "  4. Run: docker-compose pull && docker-compose up -d"
