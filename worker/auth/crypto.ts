const encoder = new TextEncoder();
const decoder = new TextDecoder();
const AES_GCM_IV_BYTES = 12;
const ENCRYPTION_KEY_BYTES = 32;
const AUTH_TRANSACTION_TTL_MS = 5 * 60 * 1000;
type Bytes = Uint8Array<ArrayBuffer>;
const SECRET_AAD = encoder.encode("webdraw:secret:v1");
const AUTH_TRANSACTION_AAD = encoder.encode("webdraw:auth-transaction:v1");

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  formatVersion: 1;
}

export interface AuthTransaction {
  state: string;
  verifier: string;
  next: string;
  expiresAt: number;
}

export type AuthTransactionInput = Omit<AuthTransaction, "expiresAt"> & {
  expiresAt?: number;
};

export async function createPkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomToken();

  return { verifier, challenge: await hashToken(verifier) };
}

export function randomToken(bytes = 32): string {
  if (!Number.isInteger(bytes) || bytes < 1 || bytes > 65_536) {
    throw new Error("Token byte length must be an integer between 1 and 65536");
  }

  const value: Bytes = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return bytesToBase64Url(value);
}

export async function hashToken(token: string): Promise<string> {
  return bytesToBase64Url(await crypto.subtle.digest("SHA-256", encoder.encode(token)));
}

export async function encryptSecret(value: string, key: string): Promise<EncryptedSecret> {
  const cryptoKey = await importEncryptionKey(key);
  return encryptBytes(encoder.encode(value), cryptoKey, SECRET_AAD);
}

export async function decryptSecret(value: EncryptedSecret, key: string): Promise<string> {
  try {
    const cryptoKey = await importEncryptionKey(key);
    return decoder.decode(await decryptBytes(value, cryptoKey, SECRET_AAD));
  } catch {
    throw new Error("Invalid encrypted secret");
  }
}

export async function sealAuthTransaction(
  transaction: AuthTransactionInput,
  key: string,
  now = Date.now(),
): Promise<string> {
  const expiresAt = transaction.expiresAt ?? now + AUTH_TRANSACTION_TTL_MS;
  const payload: AuthTransaction = { ...transaction, expiresAt };
  const cryptoKey = await importEncryptionKey(key);
  const encrypted = await encryptBytes(
    encoder.encode(JSON.stringify(payload)),
    cryptoKey,
    AUTH_TRANSACTION_AAD,
  );

  return `v1.${encrypted.iv}.${encrypted.ciphertext}`;
}

export async function openAuthTransaction(
  value: string,
  key: string,
  now = Date.now(),
): Promise<AuthTransaction> {
  try {
    const encrypted = parseAuthTransaction(value);
    const cryptoKey = await importEncryptionKey(key);
    const parsed = JSON.parse(
      decoder.decode(await decryptBytes(encrypted, cryptoKey, AUTH_TRANSACTION_AAD)),
    );
    const transaction = validateAuthTransaction(parsed);

    if (transaction.expiresAt <= now) {
      throw new Error("Expired auth transaction");
    }

    return transaction;
  } catch {
    throw new Error("Invalid auth transaction");
  }
}

async function importEncryptionKey(value: string): Promise<CryptoKey> {
  const bytes = decodeBase64Key(value);

  if (bytes.byteLength !== ENCRYPTION_KEY_BYTES) {
    throw new Error("AUTH_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }

  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptBytes(
  plaintext: Bytes,
  key: CryptoKey,
  additionalData: Bytes,
): Promise<EncryptedSecret> {
  const iv: Bytes = new Uint8Array(AES_GCM_IV_BYTES);
  crypto.getRandomValues(iv);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData },
    key,
    plaintext,
  );

  return { ciphertext: bytesToBase64Url(ciphertext), iv: bytesToBase64Url(iv), formatVersion: 1 };
}

async function decryptBytes(
  value: EncryptedSecret,
  key: CryptoKey,
  additionalData: Bytes,
): Promise<ArrayBuffer> {
  if (value.formatVersion !== 1) {
    throw new Error("Unsupported encrypted secret format");
  }

  const iv = base64UrlToBytes(value.iv);
  const ciphertext = base64UrlToBytes(value.ciphertext);

  if (iv.byteLength !== AES_GCM_IV_BYTES || ciphertext.byteLength < 16) {
    throw new Error("Invalid encrypted secret");
  }

  return crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData }, key, ciphertext);
}

function parseAuthTransaction(value: string): EncryptedSecret {
  const match = /^v1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(value);

  if (!match) {
    throw new Error("Invalid auth transaction");
  }

  return { formatVersion: 1, iv: match[1], ciphertext: match[2] };
}

function validateAuthTransaction(value: unknown): AuthTransaction {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid auth transaction");
  }

  const transaction = value as Record<string, unknown>;
  if (
    typeof transaction.state !== "string" || !transaction.state ||
    typeof transaction.verifier !== "string" || !transaction.verifier ||
    typeof transaction.next !== "string" || !transaction.next ||
    typeof transaction.expiresAt !== "number" || !Number.isFinite(transaction.expiresAt)
  ) {
    throw new Error("Invalid auth transaction");
  }

  return {
    state: transaction.state,
    verifier: transaction.verifier,
    next: transaction.next,
    expiresAt: transaction.expiresAt,
  };
}

function decodeBase64Key(value: string): Bytes {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error("AUTH_ENCRYPTION_KEY must be base64-encoded");
  }

  return decodeBase64(value);
}

function base64UrlToBytes(value: string): Bytes {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) {
    throw new Error("Invalid base64url value");
  }

  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  return decodeBase64(value.replace(/-/g, "+").replace(/_/g, "/") + padding);
}

function decodeBase64(value: string): Bytes {
  const binary = atob(value);
  const bytes: Bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function bytesToBase64Url(value: ArrayBuffer | Bytes): string {
  const bytes = new Uint8Array(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
