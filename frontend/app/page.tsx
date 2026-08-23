"use client";

import Link from "next/link";
import { StatsBar } from "@/components/StatsBar";
import { CONTRACT_ID, EXPLORER_BASE } from "@/lib/config";

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Connect wallet",
    desc: "No wallet? Install Freighter (free) and switch it to Testnet. Zero XLM? Hit \u26fd GET FREE XLM in the header.",
    glow: "hover:shadow-glow-pink",
    accent: "text-pink",
    link: { label: "GET FREIGHTER \u2197", href: "https://freighter.app" },
  },
  {
    step: "02",
    title: "Upload your art",
    desc: "Drag & drop an image, give it a name + symbol. It gets pinned to IPFS via Pinata \u2014 decentralized forever.",
    glow: "hover:shadow-glow-violet",
    accent: "text-violet",
  },
  {
    step: "03",
    title: "Mint & track live",
    desc: "Approve one signature in your wallet and watch all 6 steps confirm in real time. Your NFT lands in MINTED NFTS.",
    glow: "hover:shadow-glow-cyan",
    accent: "text-cyan",
  },
];

const TICKER_ITEMS = [
  "MINT SIMPLE NFTS",
  "IPFS METADATA",
  "LIVE STATUS",
  "SOROBAN SMART CONTRACT",
  "SHARP GLASS UI",
  "PINATA PINNING",
];

export default function Home() {
  return (
    <>
      {/* marquee ticker strip */}
      <div className="glass-dark overflow-hidden border-x-0 py-2">
        <div className="flex w-max animate-marquee gap-8 whitespace-nowrap">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span
              key={i}
              className={`text-xs font-black uppercase tracking-[0.2em] ${
                i % 3 === 0
                  ? "text-violet"
                  : i % 3 === 1
                    ? "text-pink"
                    : "text-cyan"
              }`}
            >
              ✦ {item}
            </span>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-10">
        {/* hero */}
        <div className="glass p-8 shadow-glow-violet">
          <h2 className="font-display text-4xl font-bold leading-tight tracking-tight text-paper sm:text-6xl">
            Mint simple NFTs.
            <br />
            Own them{" "}
            <span className="bg-gradient-to-r from-violet via-pink to-cyan bg-clip-text text-transparent">
              on-chain
            </span>
            <span className="animate-blink text-violet">█</span>
          </h2>
          <p className="glass-dark mt-4 max-w-2xl p-3 text-xs font-bold leading-relaxed text-dim">
            UPLOAD ARTWORK → PIN TO IPFS VIA PINATA → MINT ON SOROBAN → TRACK
            EVERY STEP LIVE. YOUR METADATA STAYS DECENTRALIZED, YOUR OWNERSHIP
            STAYS ON-CHAIN.
          </p>

          {/* CTAs */}
          <div className="mt-6 flex flex-wrap gap-4">
            <Link
              href="/mintnft"
              className="bg-gradient-to-r from-violet to-pink px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-paper shadow-glow-violet hover:opacity-90"
            >
              ⚡ START MINTING
            </Link>
            <Link
              href="/minted-nfts"
              className="glass-strong px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-cyan hover:shadow-glow-cyan"
            >
              ▦ MINTED NFTS
            </Link>
          </div>
        </div>

        {/* how it works */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {HOW_IT_WORKS.map((s) => (
            <div
              key={s.step}
              className={`glass p-4 transition-shadow ${s.glow}`}
            >
              <span className="glass-dark inline-block px-2 py-0.5 font-display text-sm font-bold text-paper">
                {s.step}
              </span>
              <h3 className={`mt-2 font-display text-lg font-bold ${s.accent}`}>
                {s.title}
              </h3>
              <p className="mt-1 text-[11px] font-bold leading-relaxed text-dim">
                {s.desc}
              </p>
              {s.link && (
                <a
                  href={s.link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="glass-strong mt-2 inline-block px-2 py-1 text-[10px] font-black uppercase tracking-widest text-paper hover:shadow-glow-pink"
                >
                  {s.link.label}
                </a>
              )}
            </div>
          ))}
        </div>

        {/* live collection stats */}
        <StatsBar refreshKey={0} />

        {/* contract strip */}
        {CONTRACT_ID && (
          <div className="glass p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-dim">
              SMART CONTRACT (SOROBAN / TESTNET)
            </p>
            <a
              href={`${EXPLORER_BASE}/contract/${CONTRACT_ID}`}
              target="_blank"
              rel="noreferrer"
              className="break-all text-xs font-bold text-cyan underline decoration-2 underline-offset-4 hover:text-paper"
            >
              {CONTRACT_ID} ↗
            </a>
          </div>
        )}
      </main>
    </>
  );
}
