#!/bin/bash

# Deploy AU Wheelchair Basketball App to Azure VM
# Handles subscription, region, and VM type flexibility

set -e

echo "🚀 Azure Deployment Script for AU Basketball App"
echo "=================================================="

# 1. Check Azure CLI auth
echo ""
echo "✓ Checking Azure CLI authentication..."
if ! az account show &> /dev/null; then
  echo "❌ Not authenticated. Run: az login"
  exit 1
fi

SUBSCRIPTION=$(az account show --query name -o tsv)
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo "✓ Current subscription: $SUBSCRIPTION ($SUBSCRIPTION_ID)"

# 2. Determine region (prefer eastus2 but fall back to available region)
echo ""
echo "? Selecting deployment region..."

# Check if Cosmos DB exists to prefer same region
COSMOS_REGION=$(az cosmosdb list --query "[0].location" -o tsv 2>/dev/null || echo "eastus2")
PREFERRED_REGION=${COSMOS_REGION:-eastus2}

echo "  Preferred region: $PREFERRED_REGION"
echo "  (Using Cosmos DB region to keep costs down)"

REGION=$PREFERRED_REGION

# 3. Create or validate resource group
RESOURCE_GROUP="rg-apex-basket-vm"

echo ""
echo "? Setting up resource group..."
if az group exists --name "$RESOURCE_GROUP" --query value -o tsv | grep -q "true"; then
  echo "✓ Resource group '$RESOURCE_GROUP' already exists in $REGION"
else
  echo "✓ Creating resource group '$RESOURCE_GROUP' in $REGION..."
  az group create --name "$RESOURCE_GROUP" --location "$REGION"
fi

# 4. Generate SSH key if not exists
SSH_KEY_PATH="$HOME/.ssh/id_rsa"
if [ ! -f "$SSH_KEY_PATH" ]; then
  echo ""
  echo "? Generating SSH key..."
  ssh-keygen -t rsa -b 4096 -f "$SSH_KEY_PATH" -N "" -C "apex-vm"
  echo "✓ SSH key generated at $SSH_KEY_PATH"
fi

SSH_PUB_KEY=$(cat "$SSH_KEY_PATH.pub")

# 5. List available VM sizes and try Standard_B2s first
echo ""
echo "? Checking available VM sizes in $REGION..."
echo "  (Will try Standard_B2s first, then use next available)"

AVAILABLE_SIZES=$(az vm list-sizes --location "$REGION" --query "[?contains(name, 'Standard_B')].name" -o tsv)
echo "  Available B-series VMs: $(echo $AVAILABLE_SIZES | tr '\n' ',' | sed 's/,*$//')"

# Use B2s if available, otherwise try B2ms, B1s
VM_SIZE="Standard_B2s"
if ! echo "$AVAILABLE_SIZES" | grep -q "Standard_B2s"; then
  if echo "$AVAILABLE_SIZES" | grep -q "Standard_B2ms"; then
    VM_SIZE="Standard_B2ms"
    echo "⚠️  Standard_B2s not available, using Standard_B2ms"
  elif echo "$AVAILABLE_SIZES" | grep -q "Standard_B1s"; then
    VM_SIZE="Standard_B1s"
    echo "⚠️  Standard_B2s not available, using Standard_B1s (smaller)"
  else
    echo "❌ No suitable VM sizes available in $REGION"
    echo "    Try a different region or check your quotas"
    exit 1
  fi
else
  echo "✓ Standard_B2s available"
fi

# 6. Deploy Bicep template
echo ""
echo "🔄 Deploying infrastructure (Bicep)..."
echo "   Region: $REGION"
echo "   Resource Group: $RESOURCE_GROUP"
echo "   VM Size: $VM_SIZE"
echo ""

DEPLOYMENT_OUTPUT=$(az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file "./.azure/infra/main.bicep" \
  --parameters \
    location="$REGION" \
    vmSize="$VM_SIZE" \
    sshKeyData="$SSH_PUB_KEY" \
  --query properties.outputs \
  -o json)

# Extract outputs
VM_PUBLIC_IP=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.vmPublicIp.value')
VM_NAME=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.vmName.value')
ACR_NAME=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.acrName.value')
ACR_LOGIN_SERVER=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.acrLoginServer.value')

echo "✅ Infrastructure deployed!"
echo ""
echo "📍 Deployment Summary:"
echo "   VM Public IP:     $VM_PUBLIC_IP"
echo "   VM Name:          $VM_NAME"
echo "   ACR Name:         $ACR_NAME"
echo "   ACR Login Server: $ACR_LOGIN_SERVER"
echo ""

# 7. Wait for VM to be ready
echo "⏳ Waiting for VM to be ready (Docker setup)..."
echo "   This usually takes 2-3 minutes..."
echo ""

# Give cloud-init time to run (5 min timeout)
for i in {1..30}; do
  if ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" "azureuser@$VM_PUBLIC_IP" "command -v docker" &>/dev/null; then
    echo "✓ VM is ready and Docker is installed"
    break
  fi
  echo "  ... waiting ($((i*10))s)"
  sleep 10
done

# 8. Next steps
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1️⃣  SSH into your VM:"
echo "   ssh -i $SSH_KEY_PATH azureuser@$VM_PUBLIC_IP"
echo ""
echo "2️⃣  Build and push Docker images to ACR:"
echo "   az acr login --name $ACR_NAME"
echo "   docker build -t $ACR_LOGIN_SERVER/apex-app:latest ."
echo "   docker build -t $ACR_LOGIN_SERVER/apex-api:latest ./api"
echo "   docker push $ACR_LOGIN_SERVER/apex-app:latest"
echo "   docker push $ACR_LOGIN_SERVER/apex-api:latest"
echo ""
echo "3️⃣  Download docker-compose.yml to VM:"
echo "   scp -i $SSH_KEY_PATH docker-compose.yml azureuser@$VM_PUBLIC_IP:~/app/"
echo ""
echo "4️⃣  Update docker-compose.yml on VM to use ACR images:"
echo "   sed -i 's|apex-app|$ACR_LOGIN_SERVER/apex-app|g' ~/app/docker-compose.yml"
echo "   sed -i 's|apex-api|$ACR_LOGIN_SERVER/apex-api|g' ~/app/docker-compose.yml"
echo ""
echo "5️⃣  Create .env file on VM with Cosmos connection string:"
echo "   cat > ~/app/.env << 'EOF'"
echo "   COSMOS_CONNECTION_STRING=<YOUR_CONNECTION_STRING>"
echo "   EOF"
echo ""
echo "6️⃣  Start containers:"
echo "   cd ~/app && docker-compose up -d"
echo ""
echo "7️⃣  Open browser:"
echo "   http://$VM_PUBLIC_IP"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 ACR Credentials for docker login:"
az acr credential show --name "$ACR_NAME" --query "[username,passwords[0].value]" -o tsv | awk '{print "   Username: " $1 "\n   Password: " $2}'
echo ""
echo "✨ Using your Azure credits on subscription: $SUBSCRIPTION"
echo ""
