"use client";

import {
  Account,
  Address,
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from "./config";

export interface OnChainTokenMeta {
  name: string;
  uri: string;
  minter: string;
  minted_at: bigint;
}

export interface CollectionInfo {
  name: string;
  symbol: string;
  admin: string;
}

const BASE_FEE = "1000000"; // 0.1 XLM max inclusion fee for Soroban txs

function server(): rpc.Server {
  return new rpc.Server(RPC_URL, {
    allowHttp: RPC_URL.startsWith("http://"),
  });
}

function contract(): Contract {
  if (!CONTRACT_ID) throw new Error("NEXT_PUBLIC_CONTRACT_ID is not set");
  return new Contract(CONTRACT_ID);
}

/**
 * Simulate a read-only contract call and return the decoded native value.
 * Uses a throwaway account since simulations don't need a live sequence number.
 */
async function readCall<T>(method: string, ...args: xdr.ScVal[]): Promise<T> {
  const source = new Account(
    "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
    "0"
  );
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract().call(method, ...args))
    .setTimeout(60)
    .build();

  const sim = await server().simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }
  const retval = (sim as rpc.Api.SimulateTransactionSuccessResponse).result
    ?.retval;
  if (!retval) throw new Error("Simulation returned no value");
  return scValToNative(retval) as T;
}

export async function getTotalSupply(): Promise<number> {
  return readCall<number>("total_supply");
}

export async function getCollectionInfo(): Promise<CollectionInfo> {
  return readCall<CollectionInfo>("collection");
}

export async function getTokensOf(owner: string): Promise<number[]> {
  const ids = await readCall<number[]>(
    "tokens_of",
    new Address(owner).toScVal()
  );
  return Array.from(ids);
}

export async function getTokenMeta(tokenId: number): Promise<OnChainTokenMeta> {
  return readCall<OnChainTokenMeta>(
    "token_meta",
    nativeToScVal(tokenId, { type: "u32" })
  );
}

export async function getOwnerOf(tokenId: number): Promise<string> {
  return readCall<string>("owner_of", nativeToScVal(tokenId, { type: "u32" }));
}

/**
 * Best-effort map of tokenId -> mint transaction hash, built from the
 * contract's `mint` events. RPC servers only retain a limited window of
 * events, so older tokens may be missing — callers should handle that.
 */
export async function getMintTxMap(): Promise<Record<number, string>> {
  if (!CONTRACT_ID) return {};
  const map: Record<number, string> = {};
  try {
    const rpcServer = server();
    const latest = await rpcServer.getLatestLedger();
    const mintTopic = nativeToScVal("mint", { type: "symbol" }).toXdr("base64");
    const filters = [
      {
        type: "contract" as const,
        contractIds: [CONTRACT_ID],
        topics: [[mintTopic, "*"]],
      },
    ];

    const collect = (events: rpc.Api.EventResponse[]) => {
      for (const ev of events) {
        try {
          // mint event value = (token_id: u32, uri: string)
          const val = scValToNative(ev.value) as unknown;
          const id = Number(Array.isArray(val) ? val[0] : val);
          if (Number.isFinite(id) && id > 0 && ev.txHash) {
            map[id] = ev.txHash;
          }
        } catch {
          // undecodable event — skip
        }
      }
    };

    // Open the scan with the widest lookback the retention window allows.
    let res: rpc.Api.GetEventsResponse | null = null;
    for (const lookback of [120_000, 17_280, 1_440]) {
      try {
        res = await rpcServer.getEvents({
          startLedger: Math.max(latest.sequence - lookback, 1),
          filters,
          limit: 10_000,
        });
        break;
      } catch {
        // range outside retention window — try a smaller one
      }
    }
    if (!res) return map;
    collect(res.events);

    // The RPC only scans a slice of ledgers per request — follow the cursor
    // until it reaches the latest ledger (bounded to avoid endless loops).
    for (let page = 0; page < 24 && res.cursor; page++) {
      const cursorLedger = Math.floor(
        Number(res.cursor.split("-")[0]) / 4_294_967_296
      );
      if (!Number.isFinite(cursorLedger) || cursorLedger >= latest.sequence) {
        break;
      }
      const prevCursor = res.cursor;
      res = await rpcServer.getEvents({
        cursor: prevCursor,
        filters,
        limit: 10_000,
      });
      collect(res.events);
      if (res.cursor === prevCursor) break;
    }
  } catch {
    // events unavailable — caller falls back to the contract explorer link
  }
  return map;
}

export interface MintProgress {
  phase:
    | "building"
    | "simulating"
    | "awaiting-signature"
    | "submitting"
    | "confirming"
    | "success";
  txHash?: string;
  tokenId?: number;
  detail?: string;
}

/**
 * Build, simulate, sign (via wallet kit callback) and submit a mint transaction.
 * Reports progress through `onProgress` so the UI can render a live status feed.
 */
export async function mintNft(opts: {
  ownerAddress: string;
  nftName: string;
  metadataUri: string;
  signTransaction: (xdrBase64: string) => Promise<string>;
  onProgress: (p: MintProgress) => void;
}): Promise<{ txHash: string; tokenId: number }> {
  const { ownerAddress, nftName, metadataUri, signTransaction, onProgress } =
    opts;
  const rpcServer = server();

  onProgress({ phase: "building" });
  const account = await rpcServer.getAccount(ownerAddress);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract().call(
        "mint",
        new Address(ownerAddress).toScVal(),
        nativeToScVal(nftName, { type: "string" }),
        nativeToScVal(metadataUri, { type: "string" })
      )
    )
    .setTimeout(120)
    .build();

  onProgress({ phase: "simulating" });
  const prepared = await rpcServer.prepareTransaction(tx);

  onProgress({ phase: "awaiting-signature" });
  const signedXdr = await signTransaction(prepared.toXdr());
  const signedTx = TransactionBuilder.fromXdr(signedXdr, NETWORK_PASSPHRASE);

  onProgress({ phase: "submitting" });
  const sent = await rpcServer.sendTransaction(signedTx);
  if (sent.status === "ERROR") {
    throw new Error(
      `Submission failed: ${JSON.stringify(sent.errorResult ?? sent.status)}`
    );
  }

  onProgress({ phase: "confirming", txHash: sent.hash });
  const confirmed = await pollTransaction(rpcServer, sent.hash);

  let tokenId = 0;
  try {
    if (confirmed.returnValue) {
      tokenId = Number(scValToNative(confirmed.returnValue));
    }
  } catch {
    // Return-value decoding is cosmetic — the mint itself already succeeded.
  }

  onProgress({ phase: "success", txHash: sent.hash, tokenId });
  return { txHash: sent.hash, tokenId };
}

async function pollTransaction(
  rpcServer: rpc.Server,
  hash: string,
  timeoutMs = 60_000
): Promise<rpc.Api.GetSuccessfulTransactionResponse> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await rpcServer.getTransaction(hash);
    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return res;
    }
    if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed on-chain (hash: ${hash})`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Timed out waiting for transaction ${hash}`);
}

export { Networks };
