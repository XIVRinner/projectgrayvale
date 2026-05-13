/**
 * Server Compatibility Token
 *
 * Format:  base64urlContent.base64urlSignature
 *
 * Where content is base64url-encoded JSON:
 *   { "serverName": "...", "customContent": 0 | 1 }
 *
 * Signature: HMAC-SHA256(base64urlContent, clientSecret), base64url-encoded.
 *
 * ⚠ Security note:
 * This is a SHARED-SECRET HMAC scheme. Clients cannot independently verify
 * the signature without possessing the clientSecret, which is not safe to
 * ship to clients. For a production-grade solution, replace this with an
 * asymmetric signing scheme (private key signs, public key verifies).
 * This implementation is a first-pass compatibility mechanism only.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface ServerProfileTokenContent {
  readonly serverName: string;
  /** 0 = official/unmodded, 1 = custom content */
  readonly customContent: 0 | 1;
}

export interface TokenValidationResult {
  readonly valid: boolean;
  readonly content: ServerProfileTokenContent | null;
  readonly error?: string;
}

/**
 * Encode bytes to base64url (no padding, URL-safe characters).
 */
function toBase64Url(value: string | Buffer): string {
  const buf = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Decode a base64url string to a UTF-8 string.
 */
function fromBase64Url(encoded: string): string {
  // Restore standard base64 padding and characters
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (padded.length % 4)) % 4;
  const normalized = padded + "=".repeat(padding);
  return Buffer.from(normalized, "base64").toString("utf8");
}

/**
 * Generate a server compatibility token.
 *
 * @param serverName  Human-readable server name.
 * @param customContent  Whether this server uses custom content.
 * @param clientSecret  The server-side secret used to sign the token.
 */
export function generateServerProfileToken(
  serverName: string,
  customContent: boolean,
  clientSecret: string,
): string {
  const content: ServerProfileTokenContent = {
    serverName,
    customContent: customContent ? 1 : 0,
  };

  const encodedContent = toBase64Url(JSON.stringify(content));
  const signature = signContent(encodedContent, clientSecret);

  return `${encodedContent}.${signature}`;
}

/**
 * Validate a server compatibility token against the given secret.
 *
 * Validation rules:
 * - Token must have exactly two parts separated by ".".
 * - Content must be decodable and parse as valid JSON with required fields.
 * - If customContent is 0/false, signature validation is skipped.
 * - If customContent is 1/true, the HMAC signature must match.
 * - Malformed tokens always fail.
 */
export function validateServerProfileToken(
  token: string,
  clientSecret: string,
): TokenValidationResult {
  const parts = token.split(".");

  if (parts.length !== 2) {
    return {
      valid: false,
      content: null,
      error: "Token must have exactly two parts separated by '.'.",
    };
  }

  const [encodedContent, providedSignature] = parts as [string, string];
  let content: ServerProfileTokenContent;

  try {
    const decoded = fromBase64Url(encodedContent);
    const parsed = JSON.parse(decoded) as unknown;

    if (!isValidContent(parsed)) {
      return {
        valid: false,
        content: null,
        error: "Token content is missing required fields (serverName, customContent).",
      };
    }

    content = parsed;
  } catch {
    return {
      valid: false,
      content: null,
      error: "Token content could not be decoded or parsed as JSON.",
    };
  }

  // If customContent is false, signature validation is not required.
  if (content.customContent === 0) {
    return { valid: true, content };
  }

  // customContent = 1 — HMAC signature must match.
  const expectedSignature = signContent(encodedContent, clientSecret);

  try {
    const expectedBuf = Buffer.from(expectedSignature, "ascii");
    const providedBuf = Buffer.from(providedSignature, "ascii");

    if (
      expectedBuf.length !== providedBuf.length ||
      !timingSafeEqual(expectedBuf, providedBuf)
    ) {
      return {
        valid: false,
        content,
        error: "Signature verification failed. Token may have been tampered with.",
      };
    }
  } catch {
    return {
      valid: false,
      content,
      error: "Signature comparison failed.",
    };
  }

  return { valid: true, content };
}

/**
 * Decode token content without verifying the signature.
 * Useful for reading token metadata where trust is already established.
 */
export function decodeServerProfileTokenContent(
  token: string,
): ServerProfileTokenContent | null {
  const parts = token.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [encodedContent] = parts as [string, string];

  try {
    const decoded = fromBase64Url(encodedContent);
    const parsed = JSON.parse(decoded) as unknown;
    return isValidContent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function signContent(encodedContent: string, clientSecret: string): string {
  const hmac = createHmac("sha256", clientSecret);
  hmac.update(encodedContent);
  return toBase64Url(hmac.digest());
}

function isValidContent(value: unknown): value is ServerProfileTokenContent {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record["serverName"] === "string" &&
    (record["customContent"] === 0 || record["customContent"] === 1)
  );
}
