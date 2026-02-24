#!/bin/bash

# CreditOS Testnet Setup Script
# Complete setup for testing on Sui testnet

set -e

echo "🎯 CreditOS Testnet Setup"
echo "=========================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Step 1: Check Sui CLI
echo -e "${BLUE}Step 1: Checking Sui CLI...${NC}"
if ! command -v sui &> /dev/null; then
    echo -e "${RED}❌ Sui CLI not found${NC}"
    echo "Install with: cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui"
    exit 1
fi
echo -e "${GREEN}✓ Sui CLI installed${NC}"

# Step 2: Setup testnet
echo ""
echo -e "${BLUE}Step 2: Configuring testnet...${NC}"
sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443 2>/dev/null || true
sui client switch --env testnet
echo -e "${GREEN}✓ Testnet configured${NC}"

# Step 3: Get address
echo ""
echo -e "${BLUE}Step 3: Getting wallet address...${NC}"
ACTIVE_ADDRESS=$(sui client active-address)
echo -e "${GREEN}✓ Active address: $ACTIVE_ADDRESS${NC}"

# Step 4: Request tokens
echo ""
echo -e "${BLUE}Step 4: Requesting testnet tokens...${NC}"
echo "Requesting tokens from faucet..."
FAUCET_RESPONSE=$(curl -s --location --request POST 'https://faucet.testnet.sui.io/gas' \
    --header 'Content-Type: application/json' \
    --data-raw "{\"FixedAmountRequest\":{\"recipient\":\"$ACTIVE_ADDRESS\"}}")

if echo "$FAUCET_RESPONSE" | grep -q "error"; then
    echo -e "${YELLOW}⚠️  Faucet request may have failed. Check manually.${NC}"
else
    echo -e "${GREEN}✓ Tokens requested${NC}"
fi

echo "Waiting 10 seconds for tokens to arrive..."
sleep 10

# Check balance
BALANCE=$(sui client gas --json 2>/dev/null | jq -r '.[0].balance' 2>/dev/null || echo "0")
echo "Current balance: $BALANCE MIST"

# Step 5: Deploy contracts
echo ""
echo -e "${BLUE}Step 5: Deploying smart contracts...${NC}"
cd "$(dirname "$0")/.."

if [ ! -d "contracts" ]; then
    echo -e "${RED}❌ Contracts directory not found${NC}"
    exit 1
fi

cd contracts
echo "Building contracts..."
sui move build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo "Publishing to testnet..."
PUBLISH_OUTPUT=$(sui client publish --gas-budget 500000000 --json 2>&1)

if echo "$PUBLISH_OUTPUT" | grep -q "error"; then
    echo -e "${RED}❌ Deployment failed${NC}"
    echo "$PUBLISH_OUTPUT"
    exit 1
fi

PACKAGE_ID=$(echo $PUBLISH_OUTPUT | jq -r '.objectChanges[] | select(.type=="published") | .packageId' 2>/dev/null)
TX_DIGEST=$(echo $PUBLISH_OUTPUT | jq -r '.digest' 2>/dev/null)

if [ -z "$PACKAGE_ID" ] || [ "$PACKAGE_ID" = "null" ]; then
    echo -e "${RED}❌ Could not extract package ID${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Contracts deployed${NC}"
echo "Package ID: $PACKAGE_ID"
echo "Transaction: $TX_DIGEST"

# Step 6: Save deployment info
echo ""
echo -e "${BLUE}Step 6: Saving deployment info...${NC}"
cd ..
cat > deployment-info.json << EOF
{
  "network": "testnet",
  "packageId": "$PACKAGE_ID",
  "transactionDigest": "$TX_DIGEST",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "deployedBy": "$ACTIVE_ADDRESS",
  "explorerUrl": "https://suiexplorer.com/txblock/$TX_DIGEST?network=testnet"
}
EOF
echo -e "${GREEN}✓ Deployment info saved${NC}"

# Step 7: Setup .env
echo ""
echo -e "${BLUE}Step 7: Configuring environment...${NC}"

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ Created .env from .env.example${NC}"
    else
        echo -e "${YELLOW}⚠️  No .env.example found, creating basic .env${NC}"
        cat > .env << EOF
PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/creditos-backend
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
SUI_NETWORK=testnet
SUI_PACKAGE_ID=$PACKAGE_ID
FRONTEND_URL=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
    fi
fi

# Update package ID in .env
if grep -q "^SUI_PACKAGE_ID=" ".env"; then
    sed -i.bak "s|^SUI_PACKAGE_ID=.*|SUI_PACKAGE_ID=$PACKAGE_ID|" ".env"
else
    echo "SUI_PACKAGE_ID=$PACKAGE_ID" >> ".env"
fi

echo -e "${GREEN}✓ Environment configured${NC}"

# Step 8: Install dependencies
echo ""
echo -e "${BLUE}Step 8: Installing dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "📝 Summary:"
echo "  • Sui Address: $ACTIVE_ADDRESS"
echo "  • Package ID: $PACKAGE_ID"
echo "  • Explorer: https://suiexplorer.com/txblock/$TX_DIGEST?network=testnet"
echo ""
echo "🚀 Next Steps:"
echo "  1. Start MongoDB: mongod --dbpath ~/data/db"
echo "  2. Start backend: npm run dev"
echo "  3. Test with Postman (see TESTING_GUIDE.md)"
echo ""
echo "📚 Documentation:"
echo "  • Testing Guide: TESTING_GUIDE.md"
echo "  • API Docs: API_DOCUMENTATION.md"
echo "  • Deployment Info: deployment-info.json"
echo ""
