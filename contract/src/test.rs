#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, String,
};

fn setup(env: &Env) -> (AstroMintNftClient<'_>, Address) {
    let contract_id = env.register(AstroMintNft, ());
    let client = AstroMintNftClient::new(env, &contract_id);
    let admin = Address::generate(env);
    client.initialize(
        &admin,
        &String::from_str(env, "aStroMint Collection"),
        &String::from_str(env, "ASTRO"),
    );
    (client, admin)
}

#[test]
fn test_initialize_and_collection_info() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let info = client.collection();
    assert_eq!(info.name, String::from_str(&env, "aStroMint Collection"));
    assert_eq!(info.symbol, String::from_str(&env, "ASTRO"));
    assert_eq!(info.admin, admin);
    assert_eq!(client.total_supply(), 0);
    assert_eq!(
        client.name(),
        String::from_str(&env, "aStroMint Collection")
    );
    assert_eq!(client.symbol(), String::from_str(&env, "ASTRO"));
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_double_initialize_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    client.initialize(
        &admin,
        &String::from_str(&env, "Again"),
        &String::from_str(&env, "AGN"),
    );
}

#[test]
fn test_mint_assigns_sequential_ids_and_metadata() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);

    let alice = Address::generate(&env);
    let id1 = client.mint(
        &alice,
        &String::from_str(&env, "Nova #1"),
        &String::from_str(&env, "ipfs://QmHash1/metadata.json"),
    );
    let id2 = client.mint(
        &alice,
        &String::from_str(&env, "Nova #2"),
        &String::from_str(&env, "ipfs://QmHash2/metadata.json"),
    );

    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_eq!(client.total_supply(), 2);
    assert_eq!(client.owner_of(&1), alice);
    assert_eq!(client.balance(&alice), 2);

    let meta = client.token_meta(&1);
    assert_eq!(meta.name, String::from_str(&env, "Nova #1"));
    assert_eq!(
        meta.uri,
        String::from_str(&env, "ipfs://QmHash1/metadata.json")
    );
    assert_eq!(meta.minter, alice);
    assert_eq!(
        client.token_uri(&1),
        String::from_str(&env, "ipfs://QmHash1/metadata.json")
    );

    let owned = client.tokens_of(&alice);
    assert_eq!(owned.len(), 2);
    assert_eq!(owned.get(0), Some(1));
    assert_eq!(owned.get(1), Some(2));
}

#[test]
fn test_transfer_moves_ownership() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    client.mint(
        &alice,
        &String::from_str(&env, "Nova #1"),
        &String::from_str(&env, "ipfs://QmHash1"),
    );

    client.transfer(&alice, &bob, &1);

    assert_eq!(client.owner_of(&1), bob);
    assert_eq!(client.balance(&alice), 0);
    assert_eq!(client.balance(&bob), 1);
    assert_eq!(client.tokens_of(&alice).len(), 0);
    let bob_owned = client.tokens_of(&bob);
    assert_eq!(bob_owned.len(), 1);
    assert_eq!(bob_owned.get(0), Some(1));
}

#[test]
#[should_panic(expected = "not token owner")]
fn test_transfer_by_non_owner_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    client.mint(
        &alice,
        &String::from_str(&env, "Nova #1"),
        &String::from_str(&env, "ipfs://QmHash1"),
    );
    client.transfer(&bob, &alice, &1);
}

#[test]
#[should_panic(expected = "token does not exist")]
fn test_owner_of_missing_token_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    client.owner_of(&42);
}

#[test]
fn test_approve_and_transfer_from() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let carol = Address::generate(&env);
    client.mint(
        &alice,
        &String::from_str(&env, "Nova #1"),
        &String::from_str(&env, "ipfs://QmHash1"),
    );

    let live_until = env.ledger().sequence() + 1000;
    client.approve(&alice, &bob, &1, &live_until);
    assert_eq!(client.get_approved(&1), Some(bob.clone()));

    client.transfer_from(&bob, &alice, &carol, &1);
    assert_eq!(client.owner_of(&1), carol);
    // Approval is voided by the transfer.
    assert_eq!(client.get_approved(&1), None);
}

#[test]
#[should_panic(expected = "spender not authorized")]
fn test_transfer_from_without_approval_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    client.mint(
        &alice,
        &String::from_str(&env, "Nova #1"),
        &String::from_str(&env, "ipfs://QmHash1"),
    );
    client.transfer_from(&bob, &alice, &bob, &1);
}

#[test]
fn test_approve_for_all_operator_can_transfer() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);

    let alice = Address::generate(&env);
    let operator = Address::generate(&env);
    let bob = Address::generate(&env);
    client.mint(
        &alice,
        &String::from_str(&env, "Nova #1"),
        &String::from_str(&env, "ipfs://QmHash1"),
    );

    let live_until = env.ledger().sequence() + 1000;
    client.approve_for_all(&alice, &operator, &live_until);
    assert_eq!(client.is_approved_for_all(&alice, &operator), true);

    client.transfer_from(&operator, &alice, &bob, &1);
    assert_eq!(client.owner_of(&1), bob);

    // Revoke and confirm.
    client.approve_for_all(&alice, &operator, &0);
    assert_eq!(client.is_approved_for_all(&alice, &operator), false);
}

#[test]
fn test_expired_approval_is_invalid() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    client.mint(
        &alice,
        &String::from_str(&env, "Nova #1"),
        &String::from_str(&env, "ipfs://QmHash1"),
    );

    let live_until = env.ledger().sequence() + 10;
    client.approve(&alice, &bob, &1, &live_until);
    assert_eq!(client.get_approved(&1), Some(bob.clone()));

    // Jump past expiry.
    env.ledger().with_mut(|l| l.sequence_number += 100);
    assert_eq!(client.get_approved(&1), None);
}
