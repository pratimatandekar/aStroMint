//! aStroMint NFT — a standard non-fungible token contract for Soroban.
//!
//! Implements the ecosystem-standard NFT interface (OpenZeppelin-style,
//! as recognized by wallets like Freighter):
//!   balance, owner_of, transfer, transfer_from, approve, approve_for_all,
//!   get_approved, is_approved_for_all, name, symbol, token_uri
//! with standard event formats (mint / transfer / approve / approve_for_all).
//!
//! Plus aStroMint extensions used by the dApp:
//!   initialize, mint (with per-token IPFS URI), token_meta, tokens_of,
//!   total_supply, collection.

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol, Vec,
};

/// Per-token metadata stored on-chain. The heavy metadata (image, JSON)
/// lives on IPFS; we only keep the pointer + display fields here.
#[contracttype]
#[derive(Clone)]
pub struct TokenMetadata {
    /// Display name of this specific NFT.
    pub name: String,
    /// IPFS URI of the metadata JSON, e.g. "ipfs://Qm.../metadata.json".
    pub uri: String,
    /// Address that minted the token.
    pub minter: Address,
    /// Ledger timestamp (seconds) at mint time.
    pub minted_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct CollectionInfo {
    pub name: String,
    pub symbol: String,
    pub admin: Address,
}

/// A token-level approval that expires at `live_until` (ledger sequence).
#[contracttype]
#[derive(Clone)]
pub struct ApprovalData {
    pub approved: Address,
    pub live_until: u32,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    /// CollectionInfo singleton.
    Collection,
    /// Next token id / total minted count (u32).
    Supply,
    /// Token id -> owner Address.
    Owner(u32),
    /// Token id -> TokenMetadata.
    Meta(u32),
    /// Owner Address -> Vec<u32> of token ids.
    OwnedBy(Address),
    /// Token id -> ApprovalData (single approved spender per token).
    Approval(u32),
    /// (owner, operator) -> live_until ledger (u32) for operator approval.
    OperatorApproval(Address, Address),
}

const EVT_MINT: Symbol = symbol_short!("mint");
const EVT_TRANSFER: Symbol = symbol_short!("transfer");
const EVT_APPROVE: Symbol = symbol_short!("approve");

// Storage lifetimes: bump instance + persistent entries roughly every ~17 days
// of ledgers, extending to ~30 days, so active collections stay alive.
const BUMP_THRESHOLD: u32 = 17280 * 17;
const BUMP_AMOUNT: u32 = 17280 * 30;

#[contract]
pub struct AstroMintNft;

#[contractimpl]
impl AstroMintNft {
    // =====================================================================
    // Setup + minting (aStroMint extensions)
    // =====================================================================

    /// One-time setup of the collection. Panics if already initialized.
    pub fn initialize(env: Env, admin: Address, name: String, symbol: String) {
        if env.storage().instance().has(&DataKey::Collection) {
            panic!("already initialized");
        }
        admin.require_auth();

        env.storage().instance().set(
            &DataKey::Collection,
            &CollectionInfo {
                name,
                symbol,
                admin,
            },
        );
        env.storage().instance().set(&DataKey::Supply, &0u32);
        env.storage()
            .instance()
            .extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
    }

    /// Mint a new NFT to `to` with the given display name and IPFS URI.
    /// Anyone can mint for themselves; `to` must authorize the call.
    /// Returns the new token id (sequential, starting at 1).
    pub fn mint(env: Env, to: Address, name: String, uri: String) -> u32 {
        Self::require_initialized(&env);
        to.require_auth();

        let supply: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Supply)
            .unwrap_or(0u32);
        let token_id = supply + 1;

        let meta = TokenMetadata {
            name,
            uri,
            minter: to.clone(),
            minted_at: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Owner(token_id), &to);
        env.storage()
            .persistent()
            .set(&DataKey::Meta(token_id), &meta);
        Self::push_owned(&env, &to, token_id);

        env.storage().instance().set(&DataKey::Supply, &token_id);
        env.storage()
            .instance()
            .extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
        Self::bump_token(&env, token_id);

        // Standard mint event: topics ("mint", to), data: token_id.
        env.events().publish((EVT_MINT, to.clone()), token_id);

        token_id
    }

    // =====================================================================
    // Standard NFT interface (wallet-compatible)
    // =====================================================================

    /// Number of tokens owned by `owner`.
    pub fn balance(env: Env, owner: Address) -> u32 {
        let owned: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::OwnedBy(owner))
            .unwrap_or_else(|| Vec::new(&env));
        owned.len()
    }

    /// Owner of `token_id`. Panics if the token does not exist.
    pub fn owner_of(env: Env, token_id: u32) -> Address {
        env.storage()
            .persistent()
            .get(&DataKey::Owner(token_id))
            .unwrap_or_else(|| panic!("token does not exist"))
    }

    /// Transfer `token_id` from `from` to `to`. `from` must own it and authorize.
    pub fn transfer(env: Env, from: Address, to: Address, token_id: u32) {
        from.require_auth();
        Self::do_transfer(&env, &from, &to, token_id);
    }

    /// Transfer on behalf of `from`, authorized by `spender`, who must hold a
    /// valid (unexpired) token approval or operator approval.
    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, token_id: u32) {
        spender.require_auth();

        let owner = Self::owner_of(env.clone(), token_id);
        if owner != from {
            panic!("not token owner");
        }
        if spender != from && !Self::is_spender_authorized(&env, &from, &spender, token_id) {
            panic!("spender not authorized");
        }
        Self::do_transfer(&env, &from, &to, token_id);
    }

    /// Approve `approved` to transfer `token_id` until `live_until_ledger`.
    /// `approver` must be the owner (or an approved operator of the owner).
    /// Pass `live_until_ledger = 0` to revoke.
    pub fn approve(
        env: Env,
        approver: Address,
        approved: Address,
        token_id: u32,
        live_until_ledger: u32,
    ) {
        approver.require_auth();

        let owner = Self::owner_of(env.clone(), token_id);
        if approver != owner && !Self::is_operator(&env, &owner, &approver) {
            panic!("approver is not owner or operator");
        }

        if live_until_ledger == 0 {
            env.storage()
                .temporary()
                .remove(&DataKey::Approval(token_id));
        } else {
            let current = env.ledger().sequence();
            if live_until_ledger < current {
                panic!("live_until_ledger is in the past");
            }
            let key = DataKey::Approval(token_id);
            env.storage().temporary().set(
                &key,
                &ApprovalData {
                    approved: approved.clone(),
                    live_until: live_until_ledger,
                },
            );
            let ttl = live_until_ledger - current;
            env.storage().temporary().extend_ttl(&key, ttl, ttl);
        }

        // Standard approve event: topics ("approve", approver, token_id),
        // data: (approved, live_until_ledger).
        env.events().publish(
            (EVT_APPROVE, approver, token_id),
            (approved, live_until_ledger),
        );
    }

    /// Approve (or revoke with `live_until_ledger = 0`) `operator` to manage
    /// all tokens of `owner`.
    pub fn approve_for_all(env: Env, owner: Address, operator: Address, live_until_ledger: u32) {
        owner.require_auth();

        let key = DataKey::OperatorApproval(owner.clone(), operator.clone());
        if live_until_ledger == 0 {
            env.storage().temporary().remove(&key);
        } else {
            let current = env.ledger().sequence();
            if live_until_ledger < current {
                panic!("live_until_ledger is in the past");
            }
            env.storage().temporary().set(&key, &live_until_ledger);
            let ttl = live_until_ledger - current;
            env.storage().temporary().extend_ttl(&key, ttl, ttl);
        }

        // Standard event: topics ("approve_for_all", owner),
        // data: (operator, live_until_ledger).
        env.events().publish(
            (Symbol::new(&env, "approve_for_all"), owner),
            (operator, live_until_ledger),
        );
    }

    /// Currently approved spender for `token_id`, if any (and unexpired).
    pub fn get_approved(env: Env, token_id: u32) -> Option<Address> {
        let approval: Option<ApprovalData> =
            env.storage().temporary().get(&DataKey::Approval(token_id));
        match approval {
            Some(a) if a.live_until >= env.ledger().sequence() => Some(a.approved),
            _ => None,
        }
    }

    /// Whether `operator` holds a valid approval over all of `owner`'s tokens.
    pub fn is_approved_for_all(env: Env, owner: Address, operator: Address) -> bool {
        Self::is_operator(&env, &owner, &operator)
    }

    /// Collection name.
    pub fn name(env: Env) -> String {
        Self::collection(env).name
    }

    /// Collection symbol.
    pub fn symbol(env: Env) -> String {
        Self::collection(env).symbol
    }

    /// Metadata URI for `token_id` (per-token IPFS URI).
    pub fn token_uri(env: Env, token_id: u32) -> String {
        Self::token_meta(env, token_id).uri
    }

    // =====================================================================
    // Read-only extensions (used by the dApp)
    // =====================================================================

    pub fn token_meta(env: Env, token_id: u32) -> TokenMetadata {
        env.storage()
            .persistent()
            .get(&DataKey::Meta(token_id))
            .unwrap_or_else(|| panic!("token does not exist"))
    }

    pub fn total_supply(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Supply)
            .unwrap_or(0u32)
    }

    /// All token ids currently owned by `owner`.
    pub fn tokens_of(env: Env, owner: Address) -> Vec<u32> {
        env.storage()
            .persistent()
            .get(&DataKey::OwnedBy(owner))
            .unwrap_or_else(|| Vec::new(&env))
    }

    pub fn collection(env: Env) -> CollectionInfo {
        env.storage()
            .instance()
            .get(&DataKey::Collection)
            .unwrap_or_else(|| panic!("not initialized"))
    }

    // =====================================================================
    // Internal helpers
    // =====================================================================

    fn require_initialized(env: &Env) {
        if !env.storage().instance().has(&DataKey::Collection) {
            panic!("not initialized");
        }
    }

    fn do_transfer(env: &Env, from: &Address, to: &Address, token_id: u32) {
        Self::require_initialized(env);

        let owner: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Owner(token_id))
            .unwrap_or_else(|| panic!("token does not exist"));
        if owner != *from {
            panic!("not token owner");
        }

        env.storage()
            .persistent()
            .set(&DataKey::Owner(token_id), to);
        Self::remove_owned(env, from, token_id);
        Self::push_owned(env, to, token_id);
        // A transfer voids any outstanding token-level approval.
        env.storage()
            .temporary()
            .remove(&DataKey::Approval(token_id));
        Self::bump_token(env, token_id);

        // Standard transfer event: topics ("transfer", from, to), data: token_id.
        env.events()
            .publish((EVT_TRANSFER, from.clone(), to.clone()), token_id);
    }

    fn is_operator(env: &Env, owner: &Address, operator: &Address) -> bool {
        let live_until: Option<u32> = env
            .storage()
            .temporary()
            .get(&DataKey::OperatorApproval(owner.clone(), operator.clone()));
        match live_until {
            Some(l) => l >= env.ledger().sequence(),
            None => false,
        }
    }

    fn is_spender_authorized(env: &Env, owner: &Address, spender: &Address, token_id: u32) -> bool {
        if Self::is_operator(env, owner, spender) {
            return true;
        }
        let approval: Option<ApprovalData> =
            env.storage().temporary().get(&DataKey::Approval(token_id));
        match approval {
            Some(a) => a.approved == *spender && a.live_until >= env.ledger().sequence(),
            None => false,
        }
    }

    fn push_owned(env: &Env, owner: &Address, token_id: u32) {
        let key = DataKey::OwnedBy(owner.clone());
        let mut owned: Vec<u32> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(env));
        owned.push_back(token_id);
        env.storage().persistent().set(&key, &owned);
        env.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
    }

    fn remove_owned(env: &Env, owner: &Address, token_id: u32) {
        let key = DataKey::OwnedBy(owner.clone());
        let owned: Vec<u32> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(env));
        let mut next: Vec<u32> = Vec::new(env);
        for id in owned.iter() {
            if id != token_id {
                next.push_back(id);
            }
        }
        env.storage().persistent().set(&key, &next);
    }

    fn bump_token(env: &Env, token_id: u32) {
        env.storage().persistent().extend_ttl(
            &DataKey::Owner(token_id),
            BUMP_THRESHOLD,
            BUMP_AMOUNT,
        );
        env.storage().persistent().extend_ttl(
            &DataKey::Meta(token_id),
            BUMP_THRESHOLD,
            BUMP_AMOUNT,
        );
    }
}

#[cfg(test)]
mod test;
