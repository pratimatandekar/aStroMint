"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "./WalletProvider";
import { shortAddr, NETWORK } from "@/lib/config";
import { fundWithFriendbot, getXlmBalance } from "@/lib/account";

const NAV_LINKS = [
  { href: "/", label: "HOME" },
  { href: "/mintnft", label: "MINT NFT" },
  { href: "/minted-nfts", label: "MINTED NFTS" },
];

export function Navbar() {
  const pathname = usePathname();
  const { address, connecting, connect, disconnect } = useWallet();
  const [balance, setBalance] = useState<number | null | undefined>(undefined);
  const [funding, setFunding] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadBalance = useCallback(async () => {
    if (!address) return;
    try {
      setBalance(await getXlmBalance(address));
    } catch {
      setBalance(undefined);
    }
  }, [address]);

  useEffect(() => {
    setBalance(undefined);
    if (!address) return;
    loadBalance();
    // Refresh the balance every 30s so it stays roughly live.
    const t = setInterval(loadBalance, 30_000);
    return () => clearInterval(t);
  }, [address, loadBalance]);

  const handleFund = async () => {
    if (!address) return;
    setFunding(true);
    try {
      await fundWithFriendbot(address);
      await loadBalance();
    } catch {
      await loadBalance();
    } finally {
      setFunding(false);
    }
  };

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const needsFunding = balance === null;
  const lowBalance = typeof balance === "number" && balance < 1;

  return (
    <header className="glass-dark sticky top-0 z-50 border-x-0 border-t-0">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <span className="-translate-y-1.5 text-5xl font-black leading-none text-violet drop-shadow-[0_0_12px_rgba(139,92,246,0.8)]">
            ✦
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-paper">
              aStro
              <span className="bg-gradient-to-r from-violet to-pink bg-clip-text text-transparent">
                Mint
              </span>
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-dim">
              soroban nft forge
            </p>
          </div>
        </Link>

        {/* nav links */}
        <nav className="order-3 flex w-full justify-center gap-2 sm:order-none sm:w-auto">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 text-[11px] font-black uppercase tracking-widest transition-colors ${
                  active
                    ? "glass-strong text-paper shadow-glow-violet"
                    : "glass text-dim hover:text-paper"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <span className="glass hidden px-2 py-1 text-[10px] font-black uppercase tracking-widest text-lime sm:inline-block">
            ● {NETWORK}
          </span>

          {address ? (
            <>
              {/* balance chip / fund button */}
              {needsFunding || lowBalance ? (
                <button
                  onClick={handleFund}
                  disabled={funding}
                  title="Get free testnet XLM via friendbot"
                  className="glass-strong px-3 py-2 text-xs font-black uppercase text-yellow shadow-glow-violet hover:text-paper disabled:opacity-50"
                >
                  {funding
                    ? "⟳ FUNDING…"
                    : needsFunding
                      ? "⛽ GET FREE XLM"
                      : `◈ ${balance?.toFixed(1)} XLM — TOP UP`}
                </button>
              ) : (
                <span className="glass px-3 py-2 text-xs font-black text-cyan">
                  ◈{" "}
                  {balance === undefined ? "…" : `${balance.toFixed(1)} XLM`}
                </span>
              )}

              {/* address (click to copy) */}
              <button
                onClick={copyAddress}
                title="Click to copy full address"
                className="glass px-3 py-2 text-xs font-black text-paper hover:text-cyan"
              >
                {copied ? "✔ COPIED!" : `⧉ ${shortAddr(address, 5)}`}
              </button>

              <button
                onClick={disconnect}
                title="Disconnect wallet"
                className="glass px-3 py-2 text-xs font-black uppercase text-red hover:shadow-glow-red"
              >
                ✕
              </button>
            </>
          ) : (
            <button
              onClick={connect}
              disabled={connecting}
              className="bg-gradient-to-r from-violet to-pink px-4 py-2 text-xs font-black uppercase tracking-widest text-paper shadow-glow-violet hover:opacity-90 disabled:opacity-50"
            >
              {connecting ? "CONNECTING…" : "CONNECT WALLET"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
