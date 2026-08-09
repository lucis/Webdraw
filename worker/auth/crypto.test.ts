import { describe, expect, it } from "vitest";
import {
  createPkce,
  decryptSecret,
  encryptSecret,
  hashToken,
  openAuthTransaction,
  randomToken,
  sealAuthTransaction,
} from "./crypto";

const encryptionKey = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));

describe("authentication cryptography", () => {
  it("creates distinct URL-safe PKCE S256 values", async () => {
    const pkce = await createPkce();

    expect(pkce.verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(pkce.challenge).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(pkce.challenge).not.toBe(pkce.verifier);
  });

  it("creates URL-safe opaque tokens", () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(randomToken());
  });

  it("hashes an opaque token deterministically without returning it", async () => {
    const token = "session-secret-that-must-not-be-stored";

    await expect(hashToken(token)).resolves.toBe("HSUmvkOFmAd_LSd5sBaXJWttI-c0efe2ucIiNGKDalk");
    await expect(hashToken(token)).resolves.not.toContain(token);
  });

  it("round-trips a secret with a fresh AES-GCM IV", async () => {
    const encrypted = await encryptSecret("sk-or-secret", encryptionKey);

    expect(encrypted).toMatchObject({ formatVersion: 1 });
    expect(encrypted.iv).toMatch(/^[A-Za-z0-9_-]{16}$/);
    await expect(decryptSecret(encrypted, encryptionKey)).resolves.toBe("sk-or-secret");
  });

  it("rejects modified AES-GCM ciphertext", async () => {
    const encrypted = await encryptSecret("sk-or-secret", encryptionKey);
    const replacement = encrypted.ciphertext.startsWith("A") ? "B" : "A";

    await expect(
      decryptSecret({ ...encrypted, ciphertext: `${replacement}${encrypted.ciphertext.slice(1)}` }, encryptionKey),
    ).rejects.toThrow("Invalid encrypted secret");
  });

  it("opens a sealed auth transaction before its expiry", async () => {
    const cookie = await sealAuthTransaction(
      { state: "oauth-state", verifier: "pkce-verifier", next: "/canvas", expiresAt: 10_001 },
      encryptionKey,
    );

    expect(cookie).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    await expect(openAuthTransaction(cookie, encryptionKey, 10_000)).resolves.toEqual({
      state: "oauth-state",
      verifier: "pkce-verifier",
      next: "/canvas",
      expiresAt: 10_001,
    });
  });

  it("rejects an expired sealed auth transaction", async () => {
    const cookie = await sealAuthTransaction(
      { state: "oauth-state", verifier: "pkce-verifier", next: "/canvas", expiresAt: 10_000 },
      encryptionKey,
    );

    await expect(openAuthTransaction(cookie, encryptionKey, 10_000)).rejects.toThrow("Invalid auth transaction");
  });
});
