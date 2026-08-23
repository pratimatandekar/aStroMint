import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const PINATA_API = "https://api.pinata.cloud";

function authHeaders(): Record<string, string> {
  const jwt = process.env.PINATA_JWT;
  if (jwt) return { Authorization: `Bearer ${jwt}` };

  const key = process.env.PINATA_API_KEY;
  const secret = process.env.PINATA_API_SECRET;
  if (key && secret) {
    return { pinata_api_key: key, pinata_secret_api_key: secret };
  }
  throw new Error(
    "Pinata credentials missing. Set PINATA_JWT or PINATA_API_KEY + PINATA_API_SECRET in .env"
  );
}

// Vercel serverless functions reject request bodies over ~4.5 MB,
// so we cap uploads at 4 MB to stay safely under that limit.
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

/**
 * POST /api/pinata/upload
 *
 * multipart/form-data:
 *  - file:        the NFT image
 *  - name:        NFT display name
 *  - symbol:      NFT symbol (short ticker, e.g. "NOVA")
 *  - description: NFT description
 *
 * Pins the image to IPFS, then pins a metadata JSON pointing at it.
 * Returns both CIDs plus ipfs:// URIs.
 */
/** Blob-like duck check — `File` global is missing on some Node runtimes. */
function isUploadedFile(
  v: unknown
): v is { size: number; type: string; name?: string; arrayBuffer: () => Promise<ArrayBuffer> } {
  return (
    typeof v === "object" &&
    v !== null &&
    "arrayBuffer" in v &&
    "size" in v &&
    "type" in v
  );
}

export async function POST(req: NextRequest) {
  try {
    const headers = authHeaders();

    let form: FormData;
    try {
      form = await req.formData();
    } catch (err) {
      console.error("[pinata/upload] malformed form data:", err);
      return NextResponse.json(
        { error: "Malformed upload request — please retry" },
        { status: 400 }
      );
    }

    const file = form.get("file");
    const name = (form.get("name") as string | null)?.trim();
    const symbol = ((form.get("symbol") as string | null)?.trim() ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 12);
    const description =
      (form.get("description") as string | null)?.trim() ?? "";

    if (!isUploadedFile(file) || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "File too large (max 4 MB)" },
        { status: 400 }
      );
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    // ---- 1. Pin the image file ----
    const fileForm = new FormData();
    fileForm.append("file", file as unknown as Blob, file.name ?? "artwork");
    fileForm.append(
      "pinataMetadata",
      JSON.stringify({ name: `astromint-image-${name}` })
    );

    let fileRes: Response;
    try {
      fileRes = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
        method: "POST",
        headers,
        body: fileForm,
        signal: AbortSignal.timeout(45_000),
      });
    } catch (err) {
      console.error("[pinata/upload] file pin network error:", err);
      return NextResponse.json(
        { error: "Could not reach Pinata — try again in a moment" },
        { status: 502 }
      );
    }
    if (!fileRes.ok) {
      const text = await fileRes.text();
      console.error("[pinata/upload] file pin rejected:", fileRes.status, text);
      return NextResponse.json(
        { error: `Pinata file upload failed (${fileRes.status})` },
        { status: 502 }
      );
    }
    const fileJson = (await fileRes.json()) as { IpfsHash: string };
    const imageCid = fileJson.IpfsHash;
    const imageUri = `ipfs://${imageCid}`;
    const gateway = (
      process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://gateway.pinata.cloud/ipfs"
    ).replace(/\/$/, "");
    const imageUrl = `${gateway}/${imageCid}`;

    // ---- 2. Pin the metadata JSON ----
    // `image` uses an HTTPS gateway URL — wallets like Freighter can't
    // resolve bare ipfs:// URIs. The raw CID is kept in image_ipfs.
    const metadata = {
      name,
      symbol,
      description,
      image: imageUrl,
      image_ipfs: imageUri,
      properties: {
        app: "aStroMint",
        chain: "stellar",
        standard: "astromint-nft-v1",
        created_at: new Date().toISOString(),
      },
    };

    let jsonRes: Response;
    try {
      jsonRes = await fetch(`${PINATA_API}/pinning/pinJSONToIPFS`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          pinataMetadata: { name: `astromint-metadata-${name}` },
          pinataContent: metadata,
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      console.error("[pinata/upload] metadata pin network error:", err);
      return NextResponse.json(
        { error: "Could not reach Pinata — try again in a moment" },
        { status: 502 }
      );
    }
    if (!jsonRes.ok) {
      const text = await jsonRes.text();
      console.error("[pinata/upload] metadata pin rejected:", jsonRes.status, text);
      return NextResponse.json(
        { error: `Pinata metadata upload failed (${jsonRes.status})` },
        { status: 502 }
      );
    }
    const jsonJson = (await jsonRes.json()) as { IpfsHash: string };
    const metadataCid = jsonJson.IpfsHash;

    return NextResponse.json({
      imageCid,
      imageUri,
      imageUrl,
      metadataCid,
      metadataUri: `ipfs://${metadataCid}`,
      metadataUrl: `${gateway}/${metadataCid}`,
      metadata,
    });
  } catch (err) {
    console.error("[pinata/upload] unhandled error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** GET /api/pinata/upload — verifies Pinata credentials. */
export async function GET() {
  try {
    const headers = authHeaders();
    const res = await fetch(`${PINATA_API}/data/testAuthentication`, {
      headers,
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: await res.text() },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
