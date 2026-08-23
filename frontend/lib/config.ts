export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";

export const NETWORK =
  (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet").toLowerCase();

export const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";

export const NETWORK_PASSPHRASE =
  NETWORK === "mainnet"
    ? "Public Global Stellar Network ; September 2015"
    : "Test SDF Network ; September 2015";

export const IPFS_GATEWAY = (
  process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://gateway.pinata.cloud/ipfs"
).replace(/\/$/, "");

export const EXPLORER_BASE =
  NETWORK === "mainnet"
    ? "https://stellar.expert/explorer/public"
    : "https://stellar.expert/explorer/testnet";

/** Convert an ipfs:// URI (or bare CID) to a browsable gateway URL. */
export function ipfsToHttp(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    return `${IPFS_GATEWAY}/${uri.slice("ipfs://".length)}`;
  }
  if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;
  return `${IPFS_GATEWAY}/${uri}`;
}

export function shortAddr(addr: string, size = 4): string {
  if (!addr) return "";
  return `${addr.slice(0, size)}…${addr.slice(-size)}`;
}
