/**
 * Client-side server compatibility token utilities.
 *
 * ⚠ Security note:
 * The server-side token is signed with HMAC-SHA256 using the server's
 * clientSecret. The client CANNOT verify the HMAC signature without
 * knowing the secret, which would be insecure to expose.
 *
 * This module therefore only handles:
 *   - Structural validation (token has two parts)
 *   - Content decoding (base64url → JSON)
 *   - Content schema validation (required fields are present)
 *
 * The actual signature integrity guarantee is provided by the server.
 * The server profile endpoint (`GET /api/server/profile`) returns a
 * freshly generated token; clients should trust that token for the
 * current connection. Stored tokens (on character bindings) are
 * validated server-side during character selection.
 *
 * For a future upgrade path, consider replacing HMAC with an asymmetric
 * scheme (private key signs / public key verifies) so clients can
 * independently verify tokens without receiving the secret.
 */

export interface ServerProfileTokenContent {
  readonly serverName: string;
  /** 0 = official/unmodded, 1 = custom content */
  readonly customContent: 0 | 1;
}

export interface ClientTokenDecodeResult {
  readonly ok: boolean;
  readonly content: ServerProfileTokenContent | null;
  readonly error?: string;
}

/**
 * Decode a server compatibility token on the client side.
 *
 * Performs structural + schema validation only.
 * Does NOT verify the HMAC signature (see module-level note).
 *
 * For customContent = 0: decode and return content.
 * For customContent = 1: decode and return content; the signature
 *   was verified by the server when the token was issued, and will
 *   be re-verified by the server during character selection.
 */
export function decodeServerProfileToken(token: string): ClientTokenDecodeResult {
  const parts = token.split(".");

  if (parts.length !== 2) {
    return {
      ok: false,
      content: null,
      error: "Token must have exactly two parts separated by '.'.",
    };
  }

  const [encodedContent] = parts as [string, string];

  try {
    const decoded = fromBase64Url(encodedContent);
    const parsed: unknown = JSON.parse(decoded);

    if (!isValidContent(parsed)) {
      return {
        ok: false,
        content: null,
        error: "Token content is missing required fields (serverName, customContent).",
      };
    }

    return { ok: true, content: parsed };
  } catch {
    return {
      ok: false,
      content: null,
      error: "Token content could not be decoded or parsed.",
    };
  }
}

/**
 * Decode base64url to a UTF-8 string.
 * Works in browser (atob + TextDecoder), Node 20+ (atob + TextDecoder),
 * and plain Jest environments (atob + TextDecoder, or pure-JS fallback).
 */
function fromBase64Url(encoded: string): string {
  // Restore standard base64 characters and padding.
  const base64 = encoded
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padding = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padding);

  // Use atob + TextDecoder when available (browser / Node 16+).
  if (typeof atob === "function" && typeof TextDecoder !== "undefined") {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i) & 0xff;
    }

    return new TextDecoder("utf-8").decode(bytes);
  }

  // Pure-JS base64 → UTF-8 decode (works everywhere, covers ASCII + BMP).
  return base64ToUtf8(padded);
}

/**
 * Pure-JS base64 to UTF-8 string.
 * Safe for environments without atob or TextDecoder.
 */
function base64ToUtf8(base64: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of base64) {
    if (char === "=") {
      break;
    }

    const value = chars.indexOf(char);

    if (value === -1) {
      continue;
    }

    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  // Decode UTF-8 byte array to string.
  let result = "";
  let i = 0;

  while (i < bytes.length) {
    const byte = bytes[i]!;

    if (byte < 0x80) {
      result += String.fromCharCode(byte);
      i++;
    } else if ((byte & 0xe0) === 0xc0) {
      const b2 = bytes[i + 1] ?? 0;
      result += String.fromCharCode(((byte & 0x1f) << 6) | (b2 & 0x3f));
      i += 2;
    } else if ((byte & 0xf0) === 0xe0) {
      const b2 = bytes[i + 1] ?? 0;
      const b3 = bytes[i + 2] ?? 0;
      result += String.fromCharCode(((byte & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f));
      i += 3;
    } else {
      i++;
    }
  }

  return result;
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
