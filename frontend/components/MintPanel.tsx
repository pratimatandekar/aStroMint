"use client";

import { useRef, useState } from "react";
import { EXPLORER_BASE, ipfsToHttp } from "@/lib/config";
import { mintNft, type MintProgress } from "@/lib/soroban";
import { useWallet } from "./WalletProvider";

type StepId =
  | "upload-image"
  | "pin-metadata"
  | "build-tx"
  | "sign"
  | "submit"
  | "confirm";

type StepState = "idle" | "active" | "done" | "error";

interface Step {
  id: StepId;
  label: string;
}

const STEPS: Step[] = [
  { id: "upload-image", label: "UPLOAD IMAGE → IPFS" },
  { id: "pin-metadata", label: "PIN METADATA JSON" },
  { id: "build-tx", label: "BUILD + SIMULATE TX" },
  { id: "sign", label: "AWAITING WALLET SIGNATURE" },
  { id: "submit", label: "SUBMIT TO SOROBAN" },
  { id: "confirm", label: "LEDGER CONFIRMATION" },
];

interface MintResult {
  tokenId: number;
  txHash: string;
  metadataUri: string;
  imageUri: string;
}

// Keep in sync with the server route — Vercel rejects bodies over ~4.5 MB.
const MAX_FILE_BYTES = 4 * 1024 * 1024;

/** Parse a fetch Response defensively — crashed servers return HTML, not JSON. */
async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/** Translate raw SDK/wallet errors into something a human can act on. */
function friendlyError(raw: string): string {
  const m = raw.toLowerCase();
  if (
    m.includes("declined") ||
    m.includes("denied") ||
    m.includes("reject") ||
    m.includes("cancel")
  ) {
    return "Signature was declined in your wallet. Hit MINT again and press Approve.";
  }
  if (m.includes("account not found") || m.includes("not_found")) {
    return "Your wallet has 0 testnet XLM. Click the \u26fd GET FREE XLM button in the header, then try again.";
  }
  if (m.includes("insufficient") || m.includes("underfunded")) {
    return "Not enough XLM to cover the network fee. Top up via the \u26fd button in the header.";
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "Network hiccup \u2014 check your connection and try again.";
  }
  if (m.includes("timed out")) {
    return "The network is slow right now \u2014 your mint may still confirm. Hit \u27f3 REFRESH in MY VAULT in a few seconds before re-minting.";
  }
  return raw;
}

export function MintPanel({ onMinted }: { onMinted: () => void }) {
  const { address, connect, signTransaction } = useWallet();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");

  const [busy, setBusy] = useState(false);
  const [stepStates, setStepStates] = useState<Record<StepId, StepState>>(
    () => Object.fromEntries(STEPS.map((s) => [s.id, "idle"])) as Record<
      StepId,
      StepState
    >
  );
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<MintResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLElement>(null);

  const pushLog = (line: string) =>
    setLog((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString("en-GB")}] ${line}`,
    ]);

  const setStep = (id: StepId, state: StepState) =>
    setStepStates((prev) => ({ ...prev, [id]: state }));

  const resetSteps = () => {
    setStepStates(
      Object.fromEntries(STEPS.map((s) => [s.id, "idle"])) as Record<
        StepId,
        StepState
      >
    );
    setLog([]);
    setResult(null);
    setErrorMsg("");
  };

  const onFileChange = (f: File | null) => {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : "");
    if (f && f.size > MAX_FILE_BYTES) {
      setErrorMsg(
        `Image is ${(f.size / (1024 * 1024)).toFixed(1)} MB — max is 4 MB. Compress it and re-select.`
      );
    } else {
      setErrorMsg("");
    }
  };

  const canMint = !!address && !!file && name.trim().length > 0 && !busy;

  const checklist = [
    { label: "WALLET", ok: !!address },
    { label: "ARTWORK", ok: !!file },
    { label: "NAME", ok: name.trim().length > 0 },
  ];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) onFileChange(f);
  };

  async function handleMint() {
    if (!address || !file) return;
    resetSteps();

    // Catch oversized files before wasting a round-trip (hosting limit ~4.5 MB).
    if (file.size > MAX_FILE_BYTES) {
      setErrorMsg(
        `Image is ${(file.size / (1024 * 1024)).toFixed(1)} MB — max is 4 MB. Compress it and try again.`
      );
      return;
    }

    setBusy(true);
    // On small screens the status panel is below the form — bring it into view.
    if (window.innerWidth < 1024) {
      statusRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    try {
      // ---- 1+2: Pinata upload (image + metadata in one server call) ----
      setStep("upload-image", "active");
      pushLog(`Uploading "${file.name}" (${(file.size / 1024).toFixed(1)} KB) to Pinata…`);

      const form = new FormData();
      form.append("file", file);
      form.append("name", name.trim());
      form.append("symbol", symbol.trim());
      form.append("description", description.trim());

      const res = await fetch("/api/pinata/upload", {
        method: "POST",
        body: form,
      });
      const data = (await safeJson(res)) as {
        error?: string;
        imageCid?: string;
        imageUri?: string;
        imageUrl?: string;
        metadataCid?: string;
        metadataUri?: string;
        metadataUrl?: string;
      };
      if (!res.ok) {
        if (res.status === 413) {
          throw new Error("Image too large for upload — max is 4 MB");
        }
        throw new Error(
          data.error ?? `IPFS upload failed (server error ${res.status})`
        );
      }
      if (!data.metadataUrl || !data.imageUri) {
        throw new Error("IPFS upload returned an unexpected response — try again");
      }

      setStep("upload-image", "done");
      pushLog(`Image pinned → ${data.imageCid}`);
      setStep("pin-metadata", "active");
      pushLog(`Metadata pinned → ${data.metadataCid}`);
      setStep("pin-metadata", "done");

      // ---- 3-6: on-chain mint ----
      const progressMap: Record<MintProgress["phase"], () => void> = {
        building: () => {
          setStep("build-tx", "active");
          pushLog("Building transaction…");
        },
        simulating: () => {
          pushLog("Simulating + preparing footprint…");
        },
        "awaiting-signature": () => {
          setStep("build-tx", "done");
          setStep("sign", "active");
          pushLog("Waiting for wallet signature…");
        },
        submitting: () => {
          setStep("sign", "done");
          setStep("submit", "active");
          pushLog("Broadcasting to Soroban RPC…");
        },
        confirming: () => {
          setStep("submit", "done");
          setStep("confirm", "active");
          pushLog("Polling ledger for confirmation…");
        },
        success: () => {
          setStep("confirm", "done");
        },
      };

      // The on-chain token_uri is an HTTPS gateway URL so wallets
      // (Freighter etc.) can fetch the metadata directly.
      const { txHash, tokenId } = await mintNft({
        ownerAddress: address,
        nftName: name.trim(),
        metadataUri: data.metadataUrl,
        signTransaction,
        onProgress: (p) => progressMap[p.phase](),
      });

      pushLog(`✔ CONFIRMED — token #${tokenId}`);
      pushLog(`tx: ${txHash}`);
      setResult({
        tokenId,
        txHash,
        metadataUri: data.metadataUrl,
        imageUri: data.imageUrl ?? data.imageUri,
      });

      // Reset the form for the next mint.
      setName("");
      setSymbol("");
      setDescription("");
      onFileChange(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onMinted();
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Unknown error";
      const msg = friendlyError(raw);
      setErrorMsg(msg);
      pushLog(`✖ ERROR: ${raw}`);
      setStepStates((prev) => {
        const next = { ...prev };
        for (const s of STEPS) {
          if (next[s.id] === "active") next[s.id] = "error";
        }
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full border border-white/15 bg-white/5 px-3 py-2 text-sm font-bold text-paper backdrop-blur-md placeholder:font-normal placeholder:text-dim focus:border-violet focus:bg-white/10 focus:outline-none focus:shadow-glow-violet";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* ============ LEFT: FORM ============ */}
      <section className="glass p-5">
        <h2 className="mb-4 -mx-5 -mt-5 border-b border-white/10 bg-white/5 px-5 py-3 text-sm font-black uppercase tracking-[0.3em] text-paper">
          ▚ FORGE NEW NFT
        </h2>

        {/* file drop */}
        <label
          className="mb-4 block cursor-pointer"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-dim">
            ARTWORK *
          </span>
          <div
            className={`relative flex min-h-[180px] items-center justify-center overflow-hidden border border-dashed backdrop-blur-md ${
              dragging
                ? "border-pink bg-pink/10 shadow-glow-pink"
                : "border-white/25 bg-white/5 hover:border-violet hover:shadow-glow-violet"
            }`}
          >
            {preview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="preview"
                  className="max-h-64 w-full object-contain p-2"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onFileChange(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  title="Remove image"
                  className="glass-dark absolute right-2 top-2 px-2 py-1 text-xs font-black text-red hover:shadow-glow-red"
                >
                  ✕
                </button>
              </>
            ) : (
              <div className="p-6 text-center">
                <p className="text-3xl text-violet">▦</p>
                <p className="mt-2 text-xs font-black uppercase tracking-widest text-paper">
                  {dragging ? "DROP IT HERE!" : "CLICK OR DRAG IMAGE HERE"}
                </p>
                <p className="mt-1 text-[10px] font-bold text-dim">
                  PNG / JPG / GIF / WEBP / SVG — MAX 4MB
                </p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-dim">
              NAME *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              placeholder="e.g. NOVA GENESIS #001"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-dim">
              SYMBOL
            </label>
            <input
              value={symbol}
              onChange={(e) =>
                setSymbol(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 12)
                )
              }
              maxLength={12}
              placeholder="e.g. NOVA"
              className={inputCls}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-dim">
            DESCRIPTION
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="What makes this piece special…"
            className={inputCls}
          />
        </div>

        {/* readiness checklist */}
        <div className="mb-3 flex flex-wrap gap-2">
          {checklist.map((c) => (
            <span
              key={c.label}
              className={`border px-2 py-1 text-[10px] font-black uppercase tracking-widest backdrop-blur-md ${
                c.ok
                  ? "border-lime/40 bg-lime/10 text-lime"
                  : "border-white/15 bg-white/5 text-dim"
              }`}
            >
              {c.ok ? "✔" : "□"} {c.label}
            </span>
          ))}
        </div>

        {address ? (
          <button
            onClick={handleMint}
            disabled={!canMint}
            title={
              canMint
                ? "Mint your NFT"
                : `Missing: ${checklist
                    .filter((c) => !c.ok)
                    .map((c) => c.label)
                    .join(", ")}`
            }
            className="w-full bg-gradient-to-r from-violet to-pink py-3 text-sm font-black uppercase tracking-[0.3em] text-paper shadow-glow-violet hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy
              ? "⟳ MINTING…"
              : canMint
                ? "⚡ MINT NFT"
                : `⚡ MINT NFT — ${
                    checklist.filter((c) => !c.ok).length
                  } STEP(S) LEFT`}
          </button>
        ) : (
          <button
            onClick={connect}
            className="glass-strong w-full py-3 text-sm font-black uppercase tracking-[0.3em] text-cyan hover:shadow-glow-cyan"
          >
            CONNECT WALLET TO MINT
          </button>
        )}
      </section>

      {/* ============ RIGHT: LIVE STATUS ============ */}
      <section ref={statusRef} className="glass p-5">
        <h2 className="mb-4 -mx-5 -mt-5 border-b border-white/10 bg-gradient-to-r from-violet/25 to-pink/25 px-5 py-3 text-sm font-black uppercase tracking-[0.3em] text-paper">
          ▚ LIVE STATUS
        </h2>

        {/* stepper */}
        <ol className="mb-5 space-y-2">
          {STEPS.map((step, idx) => {
            const st = stepStates[step.id];
            return (
              <li
                key={step.id}
                className={`flex items-center gap-3 border px-3 py-2 text-xs font-black uppercase tracking-wider backdrop-blur-md ${
                  st === "done"
                    ? "border-lime/40 bg-lime/10 text-lime"
                    : st === "active"
                      ? "border-violet/60 bg-violet/15 text-paper shadow-glow-violet"
                      : st === "error"
                        ? "border-red/50 bg-red/10 text-red"
                        : "border-white/10 bg-white/5 text-dim"
                }`}
              >
                <span className="inline-block w-6 text-center">
                  {st === "done"
                    ? "■"
                    : st === "active"
                      ? "▶"
                      : st === "error"
                        ? "✖"
                        : `0${idx + 1}`}
                </span>
                {step.label}
                {st === "active" && (
                  <span className="ml-auto animate-blink">█</span>
                )}
              </li>
            );
          })}
        </ol>

        {/* console log */}
        <div className="glass-dark h-40 overflow-y-auto p-3 text-[11px] leading-relaxed text-lime">
          {log.length === 0 ? (
            <p className="text-dim">
              &gt; awaiting mint sequence… <span className="animate-blink">█</span>
            </p>
          ) : (
            log.map((line, i) => (
              <p key={i} className="whitespace-pre-wrap break-all">
                &gt; {line}
              </p>
            ))
          )}
        </div>

        {errorMsg && (
          <div className="mt-4 border border-red/50 bg-red/10 p-3 text-xs font-bold text-red backdrop-blur-md">
            ✖ {errorMsg}
          </div>
        )}

        {result && (
          <div className="mt-4 border border-lime/40 bg-lime/10 p-4 shadow-glow-lime backdrop-blur-md">
            <p className="text-sm font-black uppercase tracking-widest text-lime">
              ✔ MINTED — TOKEN #{result.tokenId}
            </p>
            <div className="mt-3 space-y-1 text-[11px] font-black">
              <p>
                <a
                  className="glass-dark px-1.5 py-0.5 text-lime underline decoration-2 underline-offset-2 hover:text-paper"
                  href={`${EXPLORER_BASE}/tx/${result.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  VIEW TX ON STELLAR.EXPERT ↗
                </a>
              </p>
              <p>
                <a
                  className="glass-dark px-1.5 py-0.5 text-lime underline decoration-2 underline-offset-2 hover:text-paper"
                  href={ipfsToHttp(result.metadataUri)}
                  target="_blank"
                  rel="noreferrer"
                >
                  METADATA ON IPFS ↗
                </a>
              </p>
              <p>
                <a
                  className="glass-dark px-1.5 py-0.5 text-lime underline decoration-2 underline-offset-2 hover:text-paper"
                  href={ipfsToHttp(result.imageUri)}
                  target="_blank"
                  rel="noreferrer"
                >
                  IMAGE ON IPFS ↗
                </a>
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
