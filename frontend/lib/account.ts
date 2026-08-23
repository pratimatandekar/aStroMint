"use client";

import { NETWORK } from "./config";

const HORIZON =
  NETWORK === "mainnet"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org";

/**
 * Fetch the native XLM balance for an account.
 * Returns `null` when the account doesn't exist yet (unfunded).
 */
export async function getXlmBalance(address: string): Promise<number | null> {
  const res = await fetch(`${HORIZON}/accounts/${address}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load balance");
  const json = await res.json();
  const native = (json.balances as Array<{ asset_type: string; balance: string }>)?.find(
    (b) => b.asset_type === "native"
  );
  return native ? parseFloat(native.balance) : 0;
}

/** Fund a testnet account with free XLM via friendbot. */
export async function fundWithFriendbot(address: string): Promise<void> {
  if (NETWORK === "mainnet") {
    throw new Error("Friendbot only works on testnet");
  }
  const res = await fetch(
    `https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`
  );
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    const detail: string = j?.detail ?? "";
    if (detail.includes("createAccountAlreadyExist")) {
      throw new Error("Account is already funded");
    }
    throw new Error(detail || "Friendbot funding failed — try again");
  }
}
