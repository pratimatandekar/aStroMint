import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { WalletProvider } from "@/components/WalletProvider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "aStroMint — Soroban NFT Forge",
  description:
    "Mint simple NFTs with IPFS metadata and live status on Stellar Soroban.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={spaceGrotesk.variable}>
      <body className="flex min-h-screen flex-col antialiased">
        <WalletProvider>
          <Navbar />
          <div className="flex-1">{children}</div>
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
