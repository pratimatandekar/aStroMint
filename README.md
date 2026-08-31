# ✦ aStroMint

[![CI/CD Pipeline](https://img.shields.io/github/actions/workflow/status/pratimatandekar/aStroMint/ci.yml?branch=main&label=CI%2FCD%20Pipeline&logo=githubactions&logoColor=white)](https://github.com/pratimatandekar/aStroMint/actions/workflows/ci.yml)
[![Stellar](https://img.shields.io/badge/Stellar-Soroban%20Smart%20Contracts-7B36D9?logo=stellar&logoColor=white)](https://stellar.expert/explorer/testnet/contract/CAMWUKLKBWBA73C6J2OOEPCQS66Z7NYFOU4SHFDNNYAPWFKKTD3TRB3Y)
[![Rust](https://img.shields.io/badge/Rust-soroban--sdk%2022-DEA584?logo=rust&logoColor=black)](contract/src/lib.rs)
[![Next.js](https://img.shields.io/badge/Next.js-14%20(App%20Router)-black?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-v3-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Bun](https://img.shields.io/badge/Bun-runtime-FBF0DF?logo=bun&logoColor=black)](https://bun.sh)
[![Stellar SDK](https://img.shields.io/badge/%40stellar%2Fstellar--sdk-17-FDDA24?logo=stellar&logoColor=black)](https://www.npmjs.com/package/@stellar/stellar-sdk)
[![Wallets](https://img.shields.io/badge/StellarWalletsKit-Freighter%20%C2%B7%20xBull%20%C2%B7%20Albedo%20%2B%20more-6E56CF)](https://stellarwalletskit.dev)
[![Pinata](https://img.shields.io/badge/Pinata-IPFS%20Pinning-E4178A?logo=pinata&logoColor=white)](https://pinata.cloud)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://a-stro-mint-dapp.vercel.app/)
[![License](https://img.shields.io/badge/License-MIT-97CA00)](LICENSE)

**Upload. Pin. Mint.** A cyberpunk NFT forge built on Stellar Soroban — upload artwork, pin it to IPFS via Pinata, and mint it as an on-chain NFT with a **6-phase live status panel** that tracks every step in real time.

| | |
|---|---|
| 🔗 **Live link** | [a-stro-mint-dapp.vercel.app](https://a-stro-mint-dapp.vercel.app/) |
| 📜 **Stellar smart contract (Testnet)** | [`CAMWUKLKBWBA73C6J2OOEPCQS66Z7NYFOU4SHFDNNYAPWFKKTD3TRB3Y`](https://stellar.expert/explorer/testnet/contract/CAMWUKLKBWBA73C6J2OOEPCQS66Z7NYFOU4SHFDNNYAPWFKKTD3TRB3Y) |
| 👩‍💻 **Developed by** | [@pratimatandekar](https://x.com/pratimatandekar) |
| 🎬 **Demo Video** | [Watch on Google Drive](https://drive.google.com/file/d/1c-FIXtyFO7bawR_7rD_ooCpLqnZ5rdan/view?usp=sharing) |

---

## Overview

aStroMint replaces "trust a centralised platform" NFT minting with "trust the contract." Every NFT is a token on a Soroban smart contract — the image lives on IPFS (permanent, decentralised), the metadata CID lives on-chain, and anyone can verify ownership without touching a backend.

```
Upload image → pin to IPFS (Pinata)
    → pin metadata JSON to IPFS
        → build + simulate Soroban tx
            → wallet signature (stellar-wallets-kit)
                → submit to Soroban RPC
                    → poll until ledger confirms → token id
```

The **LIVE STATUS** panel in the UI mirrors every phase above in real time. Once confirmed, three green links appear instantly — explorer tx, metadata on IPFS, image on IPFS.

---

## Features

- **One-click mint** — fill in name, description, and optional attributes; the dApp handles everything else end-to-end.
- **6-phase live status** — each phase (upload → pin → build → sign → submit → confirm) lights up as it completes, with a scrolling log of raw progress messages.
- **IPFS-first storage** — image and metadata JSON are both pinned to IPFS via Pinata server-side API routes; credentials never reach the browser.
- **MY VAULT** — after minting, your tokens load straight from the contract (`tokens_of` + `token_meta`) with images resolved through the IPFS gateway.
- **Standard NFT interface** — the contract implements the OpenZeppelin-style interface recognised by wallets like Freighter (balance, owner_of, transfer, approve, approve_for_all, token_uri).
- **Multi-wallet support** — connect with any wallet supported by StellarWalletsKit (Freighter, xBull, Albedo, and more) through a single modal.
- **Neo-brutalist UI** — zero border-radius, hard shadows, nova-gold `#f5c518` + plasma-cyan `#00f0ff` on void-black. Built entirely with Tailwind CSS.
- **Attribute editor** — add up to 20 key/value trait pairs per NFT (stored in IPFS metadata JSON, capped and validated server-side).
- **Post-mint links** — VIEW TX ON STELLAR.EXPERT, METADATA ON IPFS, IMAGE ON IPFS — all in green to make success unmistakable.

---

## Mint flow (step by step)

```
01  UPLOAD IMAGE → IPFS       Pinata pinFileToIPFS  →  image CID
02  PIN METADATA JSON         Pinata pinJSONToIPFS  →  metadata CID
03  BUILD + SIMULATE TX       soroban prepareTransaction
04  AWAITING WALLET SIGNATURE stellar-wallets-kit signTransaction
05  SUBMIT TO SOROBAN         SorobanRpc sendTransaction
06  LEDGER CONFIRMATION       getTransaction polling → token id
```

Each step is reflected in the **LIVE STATUS** panel. On success the panel shows the minted token id and three green explorer/IPFS links.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS — neo-brutalist cyberpunk theme |
| Wallets | `@creit.tech/stellar-wallets-kit` ^1.9.5 |
| Chain (JS) | `@stellar/stellar-sdk` ^17.0.0 — SorobanRpc, tx building, XDR |
| Chain (Rust) | `soroban-sdk` 22 — NFT smart contract |
| IPFS pinning | Pinata — server-side API routes, credentials never exposed |
| Runtime | Bun |

---

## Project structure

```
aStroMint/
├── contract/
│   ├── src/
│   │   ├── lib.rs          # Full Soroban NFT contract (standard + extensions)
│   │   └── test.rs         # 10 unit tests with ledger snapshot assertions
│   ├── test_snapshots/     # Snapshot JSON fixtures for every test case
│   ├── Cargo.toml
│   └── Cargo.lock
├── frontend/
│   ├── app/
│   │   ├── page.tsx            # Landing / home page
│   │   ├── layout.tsx          # Root layout with WalletProvider + Navbar
│   │   ├── mintnft/page.tsx    # Mint page
│   │   ├── minted-nfts/page.tsx# MY VAULT page
│   │   └── api/pinata/upload/  # Server-side IPFS upload route
│   ├── components/
│   │   ├── MintPanel.tsx       # Forge form + 6-phase LIVE STATUS panel
│   │   ├── Gallery.tsx         # NFT vault grid
│   │   ├── Navbar.tsx          # Wallet connect / disconnect
│   │   ├── WalletProvider.tsx  # stellar-wallets-kit context
│   │   ├── StatsBar.tsx        # Total minted, symbol, contract address
│   │   └── Footer.tsx          # GitHub + X links
│   ├── lib/
│   │   ├── config.ts           # Soroban RPC config + contract constants
│   │   ├── soroban.ts          # mintNft transaction helper
│   │   ├── wallet.ts           # Wallet singleton helpers
│   │   └── account.ts          # Account / balance utilities
│   └── .eslintrc.json
├── scripts/
│   └── deploy.sh               # One-shot Stellar CLI deploy script
└── .github/
    └── workflows/
        └── ci.yml              # Lint + build CI pipeline
```

---

## Setup

### 1. Prerequisites

- [Bun](https://bun.sh) runtime
- Rust toolchain + `wasm32v1-none` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) (`cargo install --locked stellar-cli`)
- A [Pinata](https://pinata.cloud) account (free tier is enough)

### 2. Install frontend dependencies

```bash
cd frontend
bun install
```

### 3. Add Pinata credentials

Create `frontend/.env.local`:

```env
PINATA_API_KEY=your_key
PINATA_API_SECRET=your_secret
PINATA_JWT=your_jwt        # JWT is preferred; key+secret used as fallback
NEXT_PUBLIC_CONTRACT_ID=CAMWUKLKBWBA73C6J2OOEPCQS66Z7NYFOU4SHFDNNYAPWFKKTD3TRB3Y
```

> Credentials are **server-side only** — they never reach the browser. All Pinata calls go through the Next.js API route `app/api/pinata/upload/route.ts`.

### 4. Run locally

```bash
cd frontend
bun run dev
```

Open `http://localhost:3000`

### 5. Get a wallet + testnet XLM

- Install [Freighter](https://freighter.app) (or any wallet supported by stellar-wallets-kit) and switch to **Testnet**.
- Fund your account free via [Friendbot](https://lab.stellar.org/account/fund).

### 6. Deploy your own contract instance

```bash
# Install Stellar CLI once
cargo install --locked stellar-cli

# Deploy, initialize, and print the contract ID
./scripts/deploy.sh my-identity "My Collection" MYSYM

# Paste the printed contract ID into frontend/.env.local
```

---

## Smart contract

`contract/src/lib.rs` — a **standard NFT** (OpenZeppelin-style interface, recognised by wallets like Freighter) built with `soroban-sdk` 22.

### Standard interface (wallet-compatible)

| Function | Description |
|---|---|
| `balance(owner)` | Token count owned by an address |
| `owner_of(token_id)` | Current owner |
| `transfer(from, to, token_id)` | Move a token (auth: `from`) |
| `transfer_from(spender, from, to, token_id)` | Transfer via approval (auth: `spender`) |
| `approve(approver, approved, token_id, live_until)` | Approve one spender for one token |
| `approve_for_all(owner, operator, live_until)` | Approve an operator for all tokens |
| `get_approved(token_id)` / `is_approved_for_all(owner, operator)` | Approval queries |
| `name()` / `symbol()` / `token_uri(token_id)` | Collection + token metadata |

### aStroMint extensions (used by the dApp)

| Function | Description |
|---|---|
| `initialize(admin, name, sym)` | One-time collection setup |
| `mint(to, name, uri) -> u32` | Mint NFT with IPFS metadata URI (auth: `to`) |
| `token_meta(token_id)` | On-chain metadata (name, uri, minter, minted_at) |
| `tokens_of(owner)` | All token ids owned by an address |
| `total_supply()` / `collection()` | Supply + collection info |

Standard events: `("mint", to) = token_id`, `("transfer", from, to) = token_id`, `("approve", …)`, `("approve_for_all", …)`.

### Build & test

```bash
cd contract
cargo test                                    # 10 unit tests
cargo build --target wasm32v1-none --release  # produces astromint_nft.wasm
```

### Show your NFT in Freighter

Freighter → **Collectibles** tab → **+ Add collectible** → paste:
- **Collection address:** `CAMWUKLKBWBA73C6J2OOEPCQS66Z7NYFOU4SHFDNNYAPWFKKTD3TRB3Y`
- **Token ID:** your token number (shown after mint / in MY VAULT)

---

## Metadata format (pinned to IPFS)

```json
{
  "name": "NOVA GENESIS #001",
  "description": "…",
  "image": "ipfs://<image-cid>",
  "attributes": [{ "trait_type": "RARITY", "value": "LEGENDARY" }],
  "properties": {
    "app": "aStroMint",
    "chain": "stellar",
    "standard": "astromint-nft-v1",
    "created_at": "…"
  }
}
```

The contract stores only `name` + `ipfs://<metadata-cid>` on-chain — cheap, verifiable, decentralised.

---

## CI / CD

Every push and pull request to `main` runs the GitHub Actions pipeline defined in [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

| Step | Command | Purpose |
|---|---|---|
| Install deps | `bun install --frozen-lockfile` | Reproducible install using the lockfile |
| Lint | `bun run lint` | Runs `next lint` with ESLint + TypeScript rules |
| Build | `bun run build` | Full Next.js 14 production build — catches type errors and broken imports |

### What was fixed to make CI green

- Added `eslint`, `eslint-config-next@14.2.32`, `@typescript-eslint/eslint-plugin@7`, `@typescript-eslint/parser@7` as dev dependencies — pinned to versions compatible with **Next.js 14** (avoids the ESLint 10 / eslint-config-next 16 peer mismatch).
- Created `.eslintrc.json` extending `next/core-web-vitals` and `next/typescript`.
- Verified `bun run lint` exits with **zero warnings or errors**.
- Verified `bun run build` compiles all 5 routes successfully with no type errors.

### GitHub Actions secrets required

Add these in **Settings → Secrets → Actions** for full integration:

```
PINATA_API_KEY
PINATA_API_SECRET
PINATA_JWT
NEXT_PUBLIC_CONTRACT_ID
```

> Without them the build still passes — the Pinata API route is server-side only and not statically analysed at build time.

---

## Notes

- Pinata credentials live in `.env.local` (gitignored) and are used only in Next.js API routes (Node runtime).
- Uploads are validated server-side: image mime types only, max 15 MB, attributes capped at 20.
- Token #1 (`GENESIS TEST`) was minted during deployment verification.

---

## License

MIT — built as a demonstration project for Soroban smart-contract + Next.js integration.
