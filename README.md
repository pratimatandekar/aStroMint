# ✦ aStroMint

**Mint simple NFTs with metadata and live status — on Stellar Soroban.**

Upload artwork → pin to IPFS via Pinata → mint on a Soroban smart contract →
watch every step live in a neo-brutalist, zero-border-radius, cyberpunk UI.

```
aStroMint/
├── contract/    Soroban NFT smart contract (Rust)
├── frontend/    Next.js 14 dApp (Bun, Tailwind, stellar-wallets-kit)
└── scripts/     One-shot deploy script
```

---

## 🟢 Already deployed (testnet)

| Thing        | Value                                                      |
| ------------ | ---------------------------------------------------------- |
| Contract ID  | `CAMWUKLKBWBA73C6J2OOEPCQS66Z7NYFOU4SHFDNNYAPWFKKTD3TRB3Y` |
| Network      | Stellar **testnet**                                        |
| Collection   | `aStroMint Collection` (`ASTRO`)                           |
| Explorer     | [stellar.expert ↗](https://stellar.expert/explorer/testnet/contract/CAMWUKLKBWBA73C6J2OOEPCQS66Z7NYFOU4SHFDNNYAPWFKKTD3TRB3Y) |

The contract ID is already wired into `frontend/.env.local` — you only need to
add your Pinata credentials.

---

## 🚀 Quick start

### 1. Add your Pinata credentials

Edit `frontend/.env.local` and fill in:

```env
PINATA_API_KEY=your_key
PINATA_API_SECRET=your_secret
PINATA_JWT=your_jwt        # JWT is preferred; key+secret used as fallback
```

> These are **server-side only** — they never reach the browser. All Pinata
> calls go through the Next.js API route `app/api/pinata/upload/route.ts`.

### 2. Run the frontend

```bash
cd frontend
bun install
bun run dev
```

Open http://localhost:3000

### 3. Get a wallet + testnet XLM

- Install [Freighter](https://freighter.app) (or any Stellar wallet supported
  by stellar-wallets-kit), switch it to **Testnet**.
- Fund your account: https://lab.stellar.org/account/fund (friendbot).

### 4. Mint!

Connect wallet → upload image → name/description/attributes → **⚡ MINT NFT**.
The LIVE STATUS panel tracks all six phases in real time:

```
01 UPLOAD IMAGE → IPFS       (Pinata pinFileToIPFS)
02 PIN METADATA JSON         (Pinata pinJSONToIPFS)
03 BUILD + SIMULATE TX       (soroban prepareTransaction)
04 AWAITING WALLET SIGNATURE (stellar-wallets-kit)
05 SUBMIT TO SOROBAN         (sendTransaction)
06 LEDGER CONFIRMATION       (getTransaction polling → token id)
```

Your minted NFTs show up in **MY VAULT** below, loaded straight from the
contract (`tokens_of` + `token_meta`) with images resolved via the IPFS
gateway.

---

## 📜 Smart contract

`contract/src/lib.rs` — a **standard NFT** (OpenZeppelin-style interface,
recognized by wallets like Freighter) built with `soroban-sdk` 22:

**Standard interface (wallet-compatible):**

| Function                                        | Description                                  |
| ----------------------------------------------- | -------------------------------------------- |
| `balance(owner)`                                | Token count owned by an address              |
| `owner_of(token_id)`                            | Current owner                                |
| `transfer(from, to, token_id)`                  | Move a token (auth: `from`)                  |
| `transfer_from(spender, from, to, token_id)`    | Transfer via approval (auth: `spender`)      |
| `approve(approver, approved, token_id, live_until)` | Approve one spender for one token        |
| `approve_for_all(owner, operator, live_until)`  | Approve an operator for all tokens           |
| `get_approved(token_id)` / `is_approved_for_all(owner, operator)` | Approval queries          |
| `name()` / `symbol()` / `token_uri(token_id)`   | Collection + token metadata                  |

**aStroMint extensions (used by the dApp):**

| Function                        | Description                                       |
| ------------------------------- | ------------------------------------------------- |
| `initialize(admin, name, sym)`  | One-time collection setup                         |
| `mint(to, name, uri) -> u32`    | Mint NFT with IPFS metadata URI (auth: `to`)      |
| `token_meta(token_id)`          | On-chain metadata (name, uri, minter, minted_at)  |
| `tokens_of(owner)`              | All token ids owned by an address                 |
| `total_supply()` / `collection()` | Supply + collection info                        |

Standard events: `("mint", to) = token_id`, `("transfer", from, to) = token_id`,
`("approve", …)`, `("approve_for_all", …)`.

### Show your NFT in Freighter

Freighter → **Collectibles** tab → **+ Add collectible** → paste:
- **Collection address:** the contract ID above
- **Token ID:** your token number (shown after mint / in MINTED NFTS)

### Build & test

```bash
cd contract
cargo test                                    # 6 unit tests
cargo build --target wasm32v1-none --release  # produces astromint_nft.wasm
```

### Redeploy your own instance

```bash
# install the CLI once:
cargo install --locked stellar-cli

./scripts/deploy.sh my-identity "My Collection" MYSYM
# then copy the printed contract ID into frontend/.env.local
```

---

## 🧱 Tech stack

- **Bun** + **Next.js 14** (App Router, TypeScript)
- **@creit.tech/stellar-wallets-kit** `^1.9.5` — wallet modal (Freighter, xBull, Albedo, …)
- **@stellar/stellar-sdk** `^12.3.0` — SorobanRpc, tx building, XDR
- **Pinata** — IPFS pinning (server-side API routes, credentials never exposed)
- **Soroban** — Rust smart contract, `soroban-sdk` 22
- **Tailwind CSS** — neo-brutalist theme: zero border-radius, hard shadows,
  nova-gold `#f5c518` + plasma-cyan `#00f0ff` on void-black

## 🗂 Metadata format (pinned to IPFS)

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

The contract stores only `name` + `ipfs://<metadata-cid>` on-chain — cheap,
verifiable, decentralized.

## 🔐 Notes

- Pinata credentials live in `.env.local` (gitignored) and are used only in
  Next.js API routes (Node runtime).
- Uploads are validated server-side: image mime types only, max 15 MB,
  attributes capped at 20.
- Token #1 (`GENESIS TEST`) was minted during deployment verification by the
  deployer account.
# aStroMint
