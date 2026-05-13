import { decodeServerProfileToken } from "./server-profile-token";

// Minimal base64url encoder for test helpers (mirrors server-side logic).
function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeToken(content: object, sig = "fakesig"): string {
  return `${toBase64Url(JSON.stringify(content))}.${sig}`;
}

describe("decodeServerProfileToken (client-side)", () => {
  it("decodes a valid non-custom token", () => {
    const token = makeToken({ serverName: "Kairos Server", customContent: 0 });
    const result = decodeServerProfileToken(token);

    expect(result.ok).toBe(true);
    expect(result.content).toEqual({ serverName: "Kairos Server", customContent: 0 });
  });

  it("decodes a valid custom-content token", () => {
    const token = makeToken({ serverName: "Modded", customContent: 1 });
    const result = decodeServerProfileToken(token);

    expect(result.ok).toBe(true);
    expect(result.content?.customContent).toBe(1);
  });

  it("fails when token has only one part (no dot)", () => {
    const result = decodeServerProfileToken("justonepart");

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("fails when token has more than two parts", () => {
    const result = decodeServerProfileToken("a.b.c");

    expect(result.ok).toBe(false);
  });

  it("fails when content is not valid JSON", () => {
    const result = decodeServerProfileToken("notbase64!.sig");

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("fails when content is missing serverName", () => {
    const token = makeToken({ customContent: 0 });
    const result = decodeServerProfileToken(token);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("missing required fields");
  });

  it("fails when content is missing customContent", () => {
    const token = makeToken({ serverName: "Server" });
    const result = decodeServerProfileToken(token);

    expect(result.ok).toBe(false);
  });

  it("fails when content is an array, not an object", () => {
    const token = makeToken([1, 2, 3] as unknown as object);
    const result = decodeServerProfileToken(token);

    expect(result.ok).toBe(false);
  });
});
