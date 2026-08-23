"use client";

import Link from "next/link";
import { Gallery } from "@/components/Gallery";

export default function MintedNftsPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-paper sm:text-4xl">
            Minted NFTs<span className="animate-blink text-pink">█</span>
          </h2>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-dim">
            every nft owned by your connected wallet
          </p>
        </div>
        <Link
          href="/mintnft"
          className="bg-gradient-to-r from-violet to-pink px-4 py-2 text-[11px] font-black uppercase tracking-widest text-paper shadow-glow-violet hover:opacity-90"
        >
          ⚡ MINT ANOTHER →
        </Link>
      </div>

      <Gallery refreshKey={0} />
    </main>
  );
}
