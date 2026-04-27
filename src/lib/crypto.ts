/**
 * Token Encryption — AES-256-GCM
 *
 * Encrypts OAuth access/refresh tokens before storing in the database.
 * Decrypts them when retrieved for API calls.
 *
 * Environment variable: TOKEN_ENCRYPTION_KEY (64-char hex = 32 bytes)
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits — recommended for GCM
const TAG_LENGTH = 16; // 128 bits

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). " +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a plaintext string.
 * Returns a single string: `iv:ciphertext:authTag` (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${encrypted}:${tag.toString("hex")}`;
}

/**
 * Decrypt a string produced by `encrypt()`.
 * Input format: `iv:ciphertext:authTag` (all hex-encoded).
 * Returns null if decryption fails (tampered/wrong key) instead of throwing.
 */
export function decrypt(encrypted: string): string | null {
  try {
    const key = getKey();
    const parts = encrypted.split(":");
    if (parts.length !== 3) return null;

    const [ivHex, cipherHex, tagHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) return null;

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(cipherHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
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
