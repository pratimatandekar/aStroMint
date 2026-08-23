"use client";

import Link from "next/link";
import { useState } from "react";
import { MintPanel } from "@/components/MintPanel";
import { StatsBar } from "@/components/StatsBar";
import { CONTRACT_ID } from "@/lib/config";

export default function MintNftPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-paper sm:text-4xl">
            Mint NFT<span className="animate-blink text-violet">█</span>
          </h2>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-dim">
            upload → pin to ipfs → mint on soroban
          </p>
        </div>
        <Link
          href="/minted-nfts"
          className="glass-strong px-4 py-2 text-[11px] font-black uppercase tracking-widest text-cyan hover:shadow-glow-cyan"
        >
          ▦ VIEW MINTED NFTS →
        </Link>
      </div>

      {!CONTRACT_ID && (
        <div className="border border-red/50 bg-red/10 p-4 text-xs font-black uppercase tracking-widest text-red backdrop-blur-md">
          ⚠ NEXT_PUBLIC_CONTRACT_ID NOT SET — DEPLOY THE CONTRACT (SEE README)
          AND ADD IT TO .ENV, THEN RESTART.
        </div>
      )}

      <StatsBar refreshKey={refreshKey} />
      <MintPanel onMinted={() => setRefreshKey((k) => k + 1)} />
    </main>
  );
}
