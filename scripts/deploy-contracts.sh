#!/bin/bash

# CreditOS Smart Contract Deployment Script
# Deploys all Move contracts to Sui testnet

set -e

echo "🚀 CreditOS Contract Deployment"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if sui CLI is installed
if ! command -v sui &> /dev/null; then
    echo -e "${RED}❌ Sui CLI not found. Please install it first:${NC}"
    echo "   cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui"
    exit 1
fi

echo -e "${GREEN}✓ Sui CLI found${NC}"

# Check Sui version
SUI_VERSION=$(sui --version)
echo "Sui version: $SUI_VERSION"

# Check if we're on testnet
NETWORK=$(sui client active-env 2>/dev/null || echo "not-set")
echo "Current network: $NETWORK"

if [ "$NETWORK" != "testnet" ]; then
    echo -e "${YELLOW}⚠️  Not on testnet. Switching to testnet...${NC}"
    sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443
    sui client switch --env testnet
fi

# Get active address
ACTIVE_ADDRESS=$(sui client active-address)
echo -e "${GREEN}Active address: $ACTIVE_ADDRESS${NC}"

# Check balance
echo "Checking SUI balance..."
BALANCE=$(sui client gas --json | jq -r '.[0].balance' 2>/dev/null || echo "0")
echo "Balance: $BALANCE MIST"

if [ "$BALANCE" -lt 1000000000 ]; then
    echo -e "${YELLOW}⚠️  Low balance. Requesting testnet tokens...${NC}"
    curl --location --request POST 'https://faucet.testnet.sui.io/gas' \
        --header 'Content-Type: application/json' \
        --data-raw "{\"FixedAmountRequest\":{\"recipient\":\"$ACTIVE_ADDRESS\"}}"
    echo ""
    echo "Waiting 5 seconds for tokens to arrive..."
    sleep 5
fi

# Navigate to contracts directory
cd "$(dirname "$0")/../contracts"

echo ""
echo "📦 Building contracts..."
sui move build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build successful${NC}"

echo ""
echo "🚀 Publishing contracts to testnet..."
PUBLISH_OUTPUT=$(sui client publish --gas-budget 500000000 --json)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

# Parse deployment output
PACKAGE_ID=$(echo $PUBLISH_OUTPUT | jq -r '.objectChanges[] | select(.type=="published") | .packageId')
TX_DIGEST=$(echo $PUBLISH_OUTPUT | jq -r '.digest')

echo -e "${GREEN}✓ Deployment successful!${NC}"
echo ""
echo "📝 Deployment Details:"
echo "====================="
echo "Package ID: $PACKAGE_ID"
echo "Transaction: $TX_DIGEST"
echo "Explorer: https://suiexplorer.com/txblock/$TX_DIGEST?network=testnet"
echo ""

# Save deployment info
DEPLOY_FILE="../deployment-info.json"
cat > $DEPLOY_FILE << EOF
{
  "network": "testnet",
  "packageId": "$PACKAGE_ID",
  "transactionDigest": "$TX_DIGEST",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "deployedBy": "$ACTIVE_ADDRESS",
  "explorerUrl": "https://suiexplorer.com/txblock/$TX_DIGEST?network=testnet"
}
EOF

echo -e "${GREEN}✓ Deployment info saved to: $DEPLOY_FILE${NC}"

# Update .env file
ENV_FILE="../.env"
if [ -f "$ENV_FILE" ]; then
    # Update or add PACKAGE_ID
    if grep -q "^SUI_PACKAGE_ID=" "$ENV_FILE"; then
        sed -i.bak "s|^SUI_PACKAGE_ID=.*|SUI_PACKAGE_ID=$PACKAGE_ID|" "$ENV_FILE"
    else
        echo "SUI_PACKAGE_ID=$PACKAGE_ID" >> "$ENV_FILE"
    fi
    echo -e "${GREEN}✓ Updated .env with package ID${NC}"
fi

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Update your .env file with:"
echo "   SUI_PACKAGE_ID=$PACKAGE_ID"
echo "2. Restart your backend server"
echo "3. Test with Postman using the package ID"
