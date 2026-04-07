#!/bin/bash

# Quick reference for deployment

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 AU Basketball App — Azure VM Deployment (Using Your Azure Credits)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "✅ Files Created:"
echo "   .azure/infra/main.bicep              → Bicep infrastructure (VM, ACR, networking)"
echo "   scripts/deploy.sh                    → Deploy infrastructure (handles region/VM type)"
echo "   scripts/build-and-push.sh            → Build Docker images & push to ACR"
echo "   docker-compose.prod.yml              → Production Docker Compose config"
echo "   .azure/DEPLOY.md                     → Comprehensive deployment guide"
echo "   .azure/deployment-plan.md            → Full plan & architecture"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 Quick Start (3 commands):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1️⃣  Deploy Infrastructure (creates VM in your Azure subscription)"
echo "    chmod +x scripts/deploy.sh"
echo "    ./scripts/deploy.sh"
echo ""

echo "    ⏳ Wait 2-3 minutes for cloud-init (Docker installation)"
echo "    📍 Note: Automatically uses your Cosmos DB region to save costs"
echo "    ⚙️  Note: Falls back to available VM sizes if Standard_B2s unavailable"
echo ""

echo "2️⃣  Build & Push Docker Images to ACR"
echo "    chmod +x scripts/build-and-push.sh"
echo "    ./scripts/build-and-push.sh"
echo ""

echo "3️⃣  SSH to VM & Start Containers"
echo "    ssh -i ~/.ssh/id_rsa azureuser@<VM_PUBLIC_IP>"
echo "    # Then on VM:"
echo "    docker login <ACR_SERVER> -u <username> -p <password>"
echo "    docker-compose -f docker-compose.prod.yml pull"
echo "    COSMOS_CONNECTION_STRING='<your-connection-string>' docker-compose up -d"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💰 Cost & Credits Information:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Using Azure Credits:"
echo "  ✓ Current subscription: \$(az account show --query name -o tsv)"
echo "  ✓ Estimated cost: $50-60/month"
echo "  ✓ Eligible for 12-month FREE TIER if new account"
echo "  ✓ Automatically optimizes: deploys to Cosmos DB region (save egress costs)"
echo "  ✓ Falls back: tries smaller VMs if larger ones unavailable in region"
echo ""

echo "Check spending:"
echo "  az cost management query --timeframe MonthToDate --granularity Daily"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📖 Full Documentation:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "See .azure/DEPLOY.md for complete step-by-step guide with:"
echo "  • Detailed explanation of each step"
echo "  • Troubleshooting section"
echo "  • Verification commands"
echo "  • Cost tracking"
echo "  • Cleanup instructions"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Ready to deploy? Run: ./scripts/deploy.sh"
echo ""
