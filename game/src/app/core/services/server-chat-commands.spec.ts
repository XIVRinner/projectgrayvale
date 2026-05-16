import { resolveWhisperCommand } from "./server-chat-commands";

describe("resolveWhisperCommand", () => {
  it("parses /w aliases with quoted names", () => {
    expect(resolveWhisperCommand('/w "Aerin Vale" hello there')).toEqual({
      targetCharacterName: "Aerin Vale",
      body: "hello there",
    });
  });

  it("returns null for incomplete whisper commands", () => {
    expect(resolveWhisperCommand('/whisper "Aerin Vale"')).toBeNull();
  });
});
