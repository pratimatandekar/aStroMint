export function Footer() {
  return (
    <footer className="glass-dark border-x-0 border-b-0 py-5">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 sm:flex-row">
        <p className="font-display text-sm font-bold text-paper">
          aStro
          <span className="bg-gradient-to-r from-violet to-pink bg-clip-text text-transparent">
            Mint
          </span>{" "}
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-dim">
            ▚ soroban nft forge
          </span>
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <a
            href="https://github.com/pratimatandekar/aStroMint"
            target="_blank"
            rel="noreferrer"
            className="glass-strong px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-paper hover:shadow-glow-violet"
          >
            ⌥ GITHUB ↗
          </a>
          <a
            href="https://x.com/pratimatandekar"
            target="_blank"
            rel="noreferrer"
            className="glass px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-dim hover:text-paper"
          >
            developed by @pratimatandekar ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
