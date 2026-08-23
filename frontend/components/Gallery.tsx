"use client";

import { useCallback, useEffect, useState } from "react";
import { CONTRACT_ID, EXPLORER_BASE, ipfsToHttp } from "@/lib/config";
import { getMintTxMap, getTokenMeta, getTokensOf } from "@/lib/soroban";
import { useWallet } from "./WalletProvider";

interface GalleryItem {
  tokenId: number;
  name: string;
  uri: string;
  mintedAt: number;
  image?: string;
  description?: string;
  symbol?: string;
  txHash?: string;
}

const CARD_GLOWS = [
  "hover:shadow-glow-violet",
  "hover:shadow-glow-pink",
  "hover:shadow-glow-cyan",
  "hover:shadow-glow-lime",
];

export function Gallery({ refreshKey }: { refreshKey: number }) {
  const { address } = useWallet();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!address || !CONTRACT_ID) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [ids, txMap] = await Promise.all([
        getTokensOf(address),
        getMintTxMap(),
      ]);
      const metas = await Promise.all(
        ids.map(async (id) => {
          const meta = await getTokenMeta(id);
          const item: GalleryItem = {
            tokenId: id,
            name: meta.name,
            uri: meta.uri,
            mintedAt: Number(meta.minted_at),
            txHash: txMap[id],
          };
          // Best-effort fetch of the off-chain metadata for the image.
          try {
            const res = await fetch(ipfsToHttp(meta.uri));
            if (res.ok) {
              const json = await res.json();
              item.image = json.image ? ipfsToHttp(json.image) : undefined;
              item.description = json.description;
              item.symbol = json.symbol;
            }
          } catch {
            /* gateway hiccup — still show the on-chain data */
          }
          return item;
        })
      );
      setItems(metas.sort((a, b) => b.tokenId - a.tokenId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load NFTs");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (!address) {
    return (
      <section className="glass p-8 text-center shadow-glow-violet">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-dim">
          ▚ CONNECT WALLET TO VIEW YOUR VAULT
        </p>
      </section>
    );
  }

  return (
    <section className="glass p-5">
      <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
        <h2 className="text-sm font-black uppercase tracking-[0.3em] text-paper">
          ▚ MY VAULT{" "}
          <span className="bg-gradient-to-r from-violet to-pink bg-clip-text text-transparent">
            [{items.length}]
          </span>
        </h2>
        <button
          onClick={load}
          disabled={loading}
          className="glass-strong px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan hover:shadow-glow-cyan disabled:opacity-40"
        >
          {loading ? "⟳ SYNCING…" : "⟳ REFRESH"}
        </button>
      </div>

      {error && (
        <p className="glass mb-4 border-red/40 p-3 text-xs font-bold text-red">
          ✖ {error}
        </p>
      )}

      {!loading && items.length === 0 && !error ? (
        <p className="py-8 text-center text-xs font-black uppercase tracking-[0.3em] text-dim">
          VAULT EMPTY — MINT YOUR FIRST NFT
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, idx) => (
            <article
              key={item.tokenId}
              className={`glass-strong group transition-all hover:-translate-y-1 ${CARD_GLOWS[idx % CARD_GLOWS.length]}`}
            >
              <div className="relative flex h-48 items-center justify-center overflow-hidden border-b border-white/10 bg-void/40">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-3xl text-dim">▦</span>
                )}
                <span className="glass-dark absolute left-2 top-2 px-2 py-0.5 text-[10px] font-black text-yellow">
                  #{item.tokenId}
                </span>
                {item.symbol && (
                  <span className="glass-dark absolute right-2 top-2 px-2 py-0.5 text-[10px] font-black text-pink">
                    ${item.symbol}
                  </span>
                )}
              </div>
              <div className="p-3">
                <h3 className="truncate font-display text-sm font-bold tracking-wider text-paper">
                  {item.name}
                </h3>
                {item.description && (
                  <p className="mt-1 truncate text-[11px] font-bold text-dim">
                    {item.description}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between text-[10px] font-black uppercase text-dim">
                  <span>
                    {new Date(item.mintedAt * 1000).toLocaleDateString("en-GB")}
                  </span>
                  <span className="flex gap-2">
                    <a
                      href={
                        item.txHash
                          ? `${EXPLORER_BASE}/tx/${item.txHash}`
                          : `${EXPLORER_BASE}/contract/${CONTRACT_ID}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      title={
                        item.txHash
                          ? "View mint transaction on stellar.expert"
                          : "Mint tx outside RPC event window — opens contract on stellar.expert"
                      }
                      className="text-orange underline decoration-2 underline-offset-2 hover:text-paper"
                    >
                      TX ↗
                    </a>
                    <a
                      href={ipfsToHttp(item.uri)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan underline decoration-2 underline-offset-2 hover:text-paper"
                    >
                      IPFS ↗
                    </a>
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
