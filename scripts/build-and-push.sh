#!/bin/bash

# Complete deployment: build images, push to ACR, deploy to VM

set -e

echo "🐳 Building and Deploying Docker Images"
echo "========================================"

# Check prerequisites
if ! command -v az &> /dev/null; then
  echo "❌ Azure CLI not found. Install: https://docs.microsoft.com/cli/azure/install-azure-cli"
  exit 1
fi

if ! command -v docker &> /dev/null; then
  echo "❌ Docker not found. Install: https://docs.docker.com/get-docker/"
  exit 1
fi

# Get ACR info from resource group
RESOURCE_GROUP="rg-apex-basket-vm"
ACR_NAME=$(az acr list --resource-group "$RESOURCE_GROUP" --query "[0].name" -o tsv 2>/dev/null)
ACR_LOGIN_SERVER=$(az acr list --resource-group "$RESOURCE_GROUP" --query "[0].loginServer" -o tsv 2>/dev/null)
VM_PUBLIC_IP=$(az vm list-ip-addresses --resource-group "$RESOURCE_GROUP" --query "[0].virtualMachines[0].publicIps" -o tsv 2>/dev/null)

if [ -z "$ACR_NAME" ]; then
  echo "❌ Could not find ACR in resource group '$RESOURCE_GROUP'"
  echo "   Run ./scripts/deploy.sh first to create infrastructure"
  exit 1
fi

echo "✓ ACR: $ACR_LOGIN_SERVER"
echo "✓ VM IP: $VM_PUBLIC_IP"
echo ""

# 1. Login to ACR
echo "🔐 Logging in to ACR..."
az acr login --name "$ACR_NAME"
echo ""

# 2. Build frontend image
echo "🔨 Building frontend image..."
docker build -t "$ACR_LOGIN_SERVER/apex-app:latest" .
if [ $? -eq 0 ]; then
  echo "✓ Frontend image built"
else
  echo "❌ Failed to build frontend image"
  exit 1
fi
echo ""

# 3. Build API image
echo "🔨 Building API image..."
docker build -t "$ACR_LOGIN_SERVER/apex-api:latest" ./api
if [ $? -eq 0 ]; then
  echo "✓ API image built"
else
  echo "❌ Failed to build API image"
  exit 1
fi
echo ""

# 4. Push images
echo "📤 Pushing images to ACR..."
echo "   apex-app..."
docker push "$ACR_LOGIN_SERVER/apex-app:latest"
echo "   apex-api..."
docker push "$ACR_LOGIN_SERVER/apex-api:latest"
echo "✓ Images pushed to ACR"
echo ""

# 5. Deploy to VM
if [ -z "$VM_PUBLIC_IP" ] || [ "$VM_PUBLIC_IP" == "None" ]; then
  echo "⚠️  VM public IP not found. Skipping VM deployment."
  echo "   Run: ./scripts/deploy-to-vm.sh <vm-ip> <cosmos-connection-string>"
  exit 0
fi

echo "📡 Deploying to VM..."
echo "   VM: $VM_PUBLIC_IP"
echo ""

SSH_KEY="$HOME/.ssh/id_rsa"

# Copy docker-compose.yml to VM
echo "  Copying docker-compose.yml..."
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no docker-compose.yml "azureuser@$VM_PUBLIC_IP:~/app/" 2>/dev/null || {
  echo "⚠️  Could not SCP docker-compose.yml (VM might still be initializing)"
  echo "   Manual step: scp -i $SSH_KEY docker-compose.yml azureuser@$VM_PUBLIC_IP:~/app/"
}

echo ""
echo "✅ Images ready!"
echo ""
echo "📋 Next: Configure VM and start containers"
echo ""
echo "   1. SSH to VM:"
echo "      ssh -i $SSH_KEY azureuser@$VM_PUBLIC_IP"
echo ""
echo "   2. Create .env file with Cosmos connection string:"
echo "      cat > ~/app/.env << 'EOF'"
echo "      COSMOS_CONNECTION_STRING=<your-connection-string>"
echo "      EOF"
echo ""
echo "   3. Update docker-compose.yml to use ACR images:"
echo "      sed -i 's|apex-app:latest|$ACR_LOGIN_SERVER/apex-app:latest|g' ~/app/docker-compose.yml"
echo "      sed -i 's|apex-api:latest|$ACR_LOGIN_SERVER/apex-api:latest|g' ~/app/docker-compose.yml"
echo ""
echo "   4. Start containers:"
echo "      cd ~/app && docker-compose up -d"
echo ""
echo "   5. Open in browser:"
echo "      http://$VM_PUBLIC_IP"
echo ""
