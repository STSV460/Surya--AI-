/**
 * Token Encryption — AES-256-GCM (Web Crypto API)
 *
 * Encrypts OAuth access/refresh tokens before storing in the database.
 * Decrypts them when retrieved for API calls.
 *
 * Uses Web Crypto API so this module works in both Edge Runtime
 * (Cloudflare Pages, Vercel Edge) and Node.js.
 *
 * Environment variable: TOKEN_ENCRYPTION_KEY (64-char hex = 32 bytes)
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Wire format (unchanged for backward compatibility):
 *   `iv:ciphertext:authTag` — all hex-encoded.
 *   Web Crypto returns ciphertext+tag concatenated; we split on the
 *   trailing 16 bytes (128-bit GCM tag) to preserve the original format.
 */

const IV_LENGTH = 12; // 96 bits — recommended for GCM
const TAG_LENGTH = 16; // 128 bits

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getCryptoKey(): Promise<CryptoKey> {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). " +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  const keyBytes = hexToBytes(hex);
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a plaintext string.
 * Returns a single string: `iv:ciphertext:authTag` (all hex-encoded).
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const plaintextBytes = new TextEncoder().encode(plaintext);
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintextBytes)
  );

  // Split sealed = ciphertext || tag (last 16 bytes are the GCM auth tag)
  const ciphertext = sealed.subarray(0, sealed.length - TAG_LENGTH);
  const tag = sealed.subarray(sealed.length - TAG_LENGTH);

  return `${bytesToHex(iv)}:${bytesToHex(ciphertext)}:${bytesToHex(tag)}`;
}

/**
 * Decrypt a string produced by `encrypt()`.
 * Input format: `iv:ciphertext:authTag` (all hex-encoded).
 * Returns null if decryption fails (tampered/wrong key) instead of throwing.
 */
export async function decrypt(encrypted: string): Promise<string | null> {
  try {
    const key = await getCryptoKey();
    const parts = encrypted.split(":");
    if (parts.length !== 3) return null;

    const [ivHex, cipherHex, tagHex] = parts;
    const iv = hexToBytes(ivHex);
    const ciphertext = hexToBytes(cipherHex);
    const tag = hexToBytes(tagHex);

    if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) return null;

    // Web Crypto expects ciphertext||tag concatenated
    const sealed = new Uint8Array(ciphertext.length + tag.length);
    sealed.set(ciphertext, 0);
    sealed.set(tag, ciphertext.length);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      sealed
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    // Wrong key, tampered data, or malformed input
    return null;
  }
}

/**
 * Check if a string looks like it's already encrypted (iv:cipher:tag format).
 * Used during migration to avoid double-encrypting.
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  // Check if all parts are valid hex
  return parts.every((p) => /^[0-9a-f]+$/i.test(p));
}

/**
 * Smart decrypt: If the value is encrypted, decrypt it.
 * If decryption fails or it's not encrypted, return the original value.
 * This ensures the app doesn't break for existing plaintext tokens.
 */
export async function decryptOrPlain(value: string): Promise<string> {
  if (!isEncrypted(value)) return value;
  const decrypted = await decrypt(value);
  return decrypted ?? value;
}
