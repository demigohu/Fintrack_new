#!/bin/bash

# Script to generate remote canister bindings using DFX 0.9.2+
# This script generates TypeScript bindings for all remote canisters

echo "🚀 Generating Remote Canister Bindings..."

# Create declarations directory
mkdir -p src/declarations

# Download ckBTC and ckETH canisters first (for local candid files)
echo "📥 Downloading ckBTC and ckETH canisters..."
./scripts/download.ckbtc.sh

# Generate bindings for all remote canisters
echo "📦 Generating Internet Identity bindings..."
dfx remote generate-binding internet_identity

echo "📦 Generating ckBTC Minter bindings..."
dfx remote generate-binding ckbtc_minter

echo "📦 Generating ckBTC Ledger bindings..."
dfx remote generate-binding ckbtc_ledger

echo "📦 Generating BTC Checker bindings..."
dfx remote generate-binding btc_checker

echo "📦 Generating ckBTC Index bindings..."
dfx remote generate-binding ckbtc_index

echo "📦 Generating ckETH Minter bindings..."
dfx remote generate-binding cketh_minter

echo "📦 Generating ckETH Ledger bindings..."
dfx remote generate-binding cketh_ledger

echo "📦 Generating ckETH Index bindings..."
dfx remote generate-binding cketh_index

echo "📦 Generating EVM RPC bindings..."
dfx remote generate-binding evm_rpc

echo "📦 Generating Bitcoin bindings..."
dfx remote generate-binding bitcoin

echo "✅ All remote canister bindings generated successfully!"
echo "📁 Bindings are available in src/declarations/"

# List generated files
echo "📋 Generated files:"
find src/declarations -name "*.ts" -o -name "*.js" -o -name "*.did" | sort
