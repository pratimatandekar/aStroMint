#!/usr/bin/env bash
# aStroMint — build, deploy and initialize the NFT contract on Stellar testnet.
#
# Prerequisites:
#   - Rust with the wasm32v1-none target:  rustup target add wasm32v1-none
#   - Stellar CLI:                         cargo install --locked stellar-cli
#     (or download a release: https://github.com/stellar/stellar-cli/releases)
#
# Usage:
#   ./scripts/deploy.sh [identity-name] [collection-name] [symbol]
#
# Example:
#   ./scripts/deploy.sh astromint-deployer "aStroMint Collection" ASTRO

set -euo pipefail

IDENTITY="${1:-astromint-deployer}"
COLLECTION_NAME="${2:-aStroMint Collection}"
SYMBOL="${3:-ASTRO}"
NETWORK="testnet"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WASM="$ROOT/contract/target/wasm32v1-none/release/astromint_nft.wasm"

echo "==> [1/5] Building contract wasm…"
(cd "$ROOT/contract" && cargo build --target wasm32v1-none --release)

echo "==> [2/5] Ensuring identity '$IDENTITY' exists (funded via friendbot)…"
if ! stellar keys address "$IDENTITY" >/dev/null 2>&1; then
  stellar keys generate "$IDENTITY" --network "$NETWORK" --fund
fi
ADMIN="$(stellar keys address "$IDENTITY")"
echo "    admin: $ADMIN"

echo "==> [3/5] Deploying contract…"
CONTRACT_ID="$(stellar contract deploy \
  --wasm "$WASM" \
  --source "$IDENTITY" \
  --network "$NETWORK" 2>/dev/null | tail -n 1)"
echo "    contract: $CONTRACT_ID"

echo "==> [4/5] Initializing collection…"
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  -- initialize \
  --admin "$ADMIN" \
  --name "$COLLECTION_NAME" \
  --symbol "$SYMBOL"

echo "==> [5/5] Done!"
echo ""
echo "Add this to frontend/.env.local:"
echo "  NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID"
echo ""
echo "Explorer: https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID"
