import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Glassmorphism palette — dark void + neon accents
        void: "#070710",
        paper: "#FFFFFF",
        dim: "#8E8EA3",
        violet: "#8B5CF6",
        pink: "#FF6EC7",
        cyan: "#22D3EE",
        lime: "#4ADE80",
        red: "#F43F5E",
        yellow: "#FACC15",
        orange: "#FF7051",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      boxShadow: {
        "glow-violet": "0 0 24px rgba(139, 92, 246, 0.35)",
        "glow-pink": "0 0 24px rgba(255, 110, 199, 0.3)",
        "glow-cyan": "0 0 24px rgba(34, 211, 238, 0.3)",
        "glow-lime": "0 0 24px rgba(74, 222, 128, 0.3)",
        "glow-red": "0 0 24px rgba(244, 63, 94, 0.35)",
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        float: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(40px, -30px) scale(1.08)" },
        },
      },
      animation: {
        blink: "blink 1s step-end infinite",
        marquee: "marquee 20s linear infinite",
        float: "float 14s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
