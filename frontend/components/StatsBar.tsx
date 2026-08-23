"use client";

import { useEffect, useState } from "react";
import { CONTRACT_ID, EXPLORER_BASE, shortAddr } from "@/lib/config";
import { getCollectionInfo, getTotalSupply } from "@/lib/soroban";

export function StatsBar({ refreshKey }: { refreshKey: number }) {
  const [supply, setSupply] = useState<number | null>(null);
  const [symbol, setSymbol] = useState<string>("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!CONTRACT_ID) return;
    let cancelled = false;
    (async () => {
      try {
        const [s, info] = await Promise.all([
          getTotalSupply(),
          getCollectionInfo(),
        ]);
        if (!cancelled) {
          setSupply(s);
          setSymbol(info.symbol);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const cells: Array<{ label: string; value: string; accent: string; glow: string }> = [
    {
      label: "TOTAL MINTED",
      value: error ? "—" : supply === null ? "…" : String(supply),
      accent: "text-yellow",
      glow: "hover:shadow-glow-violet",
    },
    {
      label: "SYMBOL",
      value: symbol || "—",
      accent: "text-pink",
      glow: "hover:shadow-glow-pink",
    },
    {
      label: "CONTRACT",
      value: CONTRACT_ID ? shortAddr(CONTRACT_ID, 5) : "NOT SET",
      accent: CONTRACT_ID ? "text-cyan" : "text-red",
      glow: "hover:shadow-glow-cyan",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cells.map((c) => (
        <div
          key={c.label}
          className={`glass px-4 py-3 transition-shadow ${c.glow}`}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-dim">
            {c.label}
          </p>
          {c.label === "CONTRACT" && CONTRACT_ID ? (
            <a
              href={`${EXPLORER_BASE}/contract/${CONTRACT_ID}`}
              target="_blank"
              rel="noreferrer"
              className={`text-xl font-black ${c.accent} underline decoration-2 underline-offset-4 hover:text-paper`}
            >
              {c.value}
            </a>
          ) : (
            <p className={`text-2xl font-black ${c.accent}`}>{c.value}</p>
          )}
        </div>
      ))}
    </div>
  );
}
