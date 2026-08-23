"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { NETWORK_PASSPHRASE } from "@/lib/config";
import {
  forgetWallet,
  getKit,
  recallWallet,
  rememberWallet,
} from "@/lib/wallet";

interface WalletContextValue {
  address: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdrBase64: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Restore a previous session on load.
  useEffect(() => {
    const saved = recallWallet();
    if (!saved) return;
    (async () => {
      try {
        const kit = getKit();
        kit.setWallet(saved.walletId);
        const { address: current } = await kit.getAddress();
        if (current === saved.address) setAddress(current);
        else forgetWallet();
      } catch {
        forgetWallet();
      }
    })();
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const kit = getKit();
      await kit.openModal({
        onWalletSelected: async (option) => {
          kit.setWallet(option.id);
          const { address: addr } = await kit.getAddress();
          setAddress(addr);
          rememberWallet(option.id, addr);
        },
      });
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    forgetWallet();
    getKit()
      .disconnect()
      .catch(() => {});
  }, []);

  const signTransaction = useCallback(
    async (xdrBase64: string) => {
      if (!address) throw new Error("Wallet not connected");
      const kit = getKit();
      const { signedTxXdr } = await kit.signTransaction(xdrBase64, {
        address,
        networkPassphrase: NETWORK_PASSPHRASE,
      });
      return signedTxXdr;
    },
    [address]
  );

  const value = useMemo(
    () => ({ address, connecting, connect, disconnect, signTransaction }),
    [address, connecting, connect, disconnect, signTransaction]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
