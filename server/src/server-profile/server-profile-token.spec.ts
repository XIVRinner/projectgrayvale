import {
  generateServerProfileToken,
  validateServerProfileToken,
  decodeServerProfileTokenContent,
} from "./server-profile-token";

const SECRET = "test-secret-value";
const SERVER_NAME = "Kairos Server";

describe("generateServerProfileToken", () => {
  it("produces a token with exactly two parts separated by '.'", () => {
    const token = generateServerProfileToken(SERVER_NAME, false, SECRET);
    const parts = token.split(".");

    expect(parts).toHaveLength(2);
    expect(parts[0]).not.toBe("");
    expect(parts[1]).not.toBe("");
  });

  it("encodes serverName and customContent=0 for a non-custom server", () => {
    const token = generateServerProfileToken(SERVER_NAME, false, SECRET);
    const content = decodeServerProfileTokenContent(token);

    expect(content).toEqual({ serverName: SERVER_NAME, customContent: 0 });
  });

  it("encodes serverName and customContent=1 for a custom content server", () => {
    const token = generateServerProfileToken("Kairos Modded Server", true, SECRET);
    const content = decodeServerProfileTokenContent(token);

    expect(content).toEqual({ serverName: "Kairos Modded Server", customContent: 1 });
  });

  it("produces the same token for the same inputs (deterministic)", () => {
    const a = generateServerProfileToken(SERVER_NAME, false, SECRET);
    const b = generateServerProfileToken(SERVER_NAME, false, SECRET);

    expect(a).toBe(b);
  });

  it("produces a different token when the secret changes", () => {
    const a = generateServerProfileToken(SERVER_NAME, false, "secret-a");
    const b = generateServerProfileToken(SERVER_NAME, false, "secret-b");

    expect(a).not.toBe(b);
  });

  it("produces a different token when the server name changes", () => {
    const a = generateServerProfileToken("Server A", false, SECRET);
    const b = generateServerProfileToken("Server B", false, SECRET);

    expect(a).not.toBe(b);
  });

  it("produces a different token when customContent changes", () => {
    const a = generateServerProfileToken(SERVER_NAME, false, SECRET);
    const b = generateServerProfileToken(SERVER_NAME, true, SECRET);

    expect(a).not.toBe(b);
  });

  it("uses base64url encoding (no + / = characters)", () => {
    const token = generateServerProfileToken(SERVER_NAME, false, SECRET);

    expect(token).not.toMatch(/[+/=]/);
  });
});

describe("validateServerProfileToken", () => {
  it("validates a correctly generated token", () => {
    const token = generateServerProfileToken(SERVER_NAME, false, SECRET);
    const result = validateServerProfileToken(token, SECRET);

    expect(result.valid).toBe(true);
    expect(result.content).toEqual({ serverName: SERVER_NAME, customContent: 0 });
  });

  it("validates a custom-content token with correct signature", () => {
    const token = generateServerProfileToken("Modded", true, SECRET);
    const result = validateServerProfileToken(token, SECRET);

    expect(result.valid).toBe(true);
    expect(result.content?.customContent).toBe(1);
  });

  it("accepts non-custom token even when signature is missing or wrong (customContent=0 skips HMAC)", () => {
    const token = generateServerProfileToken(SERVER_NAME, false, SECRET);
    // Split and replace signature with garbage — should still pass since customContent=0
    const parts = token.split(".");
    const tampered = `${parts[0]}.garbage-signature`;
    const result = validateServerProfileToken(tampered, SECRET);

    expect(result.valid).toBe(true);
    expect(result.content?.serverName).toBe(SERVER_NAME);
  });

  it("rejects a custom-content token with wrong signature", () => {
    const token = generateServerProfileToken("Modded", true, SECRET);
    const parts = token.split(".");
    const tampered = `${parts[0]}.wrongsig`;

    const result = validateServerProfileToken(tampered, "wrong-secret");

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects a token with only one part (no dot separator)", () => {
    const result = validateServerProfileToken("onlyonepart", SECRET);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("two parts");
  });

  it("rejects a token with more than two parts", () => {
    const result = validateServerProfileToken("a.b.c", SECRET);

    expect(result.valid).toBe(false);
  });

  it("rejects a token whose content is not valid base64url JSON", () => {
    const result = validateServerProfileToken("notbase64!.sig", SECRET);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects a token whose content is missing required fields", () => {
    // Encode a JSON object that is missing serverName.
    const badContent = Buffer.from(JSON.stringify({ customContent: 0 })).toString("base64url");
    const result = validateServerProfileToken(`${badContent}.sig`, SECRET);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("missing required fields");
  });

  it("rejects a token whose content is not an object", () => {
    const badContent = Buffer.from(JSON.stringify([1, 2, 3])).toString("base64url");
    const result = validateServerProfileToken(`${badContent}.sig`, SECRET);

    expect(result.valid).toBe(false);
  });
});

describe("decodeServerProfileTokenContent", () => {
  it("decodes token content without checking the signature", () => {
    const token = generateServerProfileToken(SERVER_NAME, false, SECRET);
    const content = decodeServerProfileTokenContent(token);

    expect(content).toEqual({ serverName: SERVER_NAME, customContent: 0 });
  });

  it("returns null for a malformed token", () => {
    expect(decodeServerProfileTokenContent("notavalidtoken")).toBeNull();
    expect(decodeServerProfileTokenContent("")).toBeNull();
    expect(decodeServerProfileTokenContent("a.b.c")).toBeNull();
  });
});
