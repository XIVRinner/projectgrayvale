import { sampleCharacterIdentity, sampleCharacterIdentityNoRank } from "../examples";
import { characterIdentitySchema } from "../schemas";

describe("characterIdentitySchema", () => {
  it("accepts a full character identity with adventurer rank", () => {
    const input = { ...sampleCharacterIdentity, adventurerRank: 1 };
    expect(characterIdentitySchema.parse(input)).toEqual(input);
  });

  it("accepts a character identity without adventurer rank", () => {
    expect(characterIdentitySchema.parse(sampleCharacterIdentity)).toEqual(
      sampleCharacterIdentity
    );
  });

  it("accepts a minimal character identity without optional fields", () => {
    expect(
      characterIdentitySchema.parse(sampleCharacterIdentityNoRank)
    ).toEqual(sampleCharacterIdentityNoRank);
  });

  it("accepts a character identity without classId", () => {
    const input = { ...sampleCharacterIdentity };
    const { classId: _, ...rest } = input;
    expect(characterIdentitySchema.parse(rest)).toEqual(rest);
  });

  it("accepts tags array with multiple combat-relevant tags", () => {
    const input = { ...sampleCharacterIdentity, tags: ["elf", "humanoid", "fey-touched"] };
    expect(characterIdentitySchema.parse(input).tags).toEqual([
      "elf",
      "humanoid",
      "fey-touched"
    ]);
  });

  it("accepts an empty tags array", () => {
    const input = { ...sampleCharacterIdentity, tags: [] };
    expect(characterIdentitySchema.parse(input).tags).toEqual([]);
  });

  it("rejects a level below 1", () => {
    expect(() =>
      characterIdentitySchema.parse({ ...sampleCharacterIdentity, level: 0 })
    ).toThrow();
  });

  it("rejects a non-integer level", () => {
    expect(() =>
      characterIdentitySchema.parse({ ...sampleCharacterIdentity, level: 1.5 })
    ).toThrow();
  });

  it("rejects an adventurerRank below 1", () => {
    expect(() =>
      characterIdentitySchema.parse({ ...sampleCharacterIdentity, adventurerRank: 0 })
    ).toThrow();
  });

  it("rejects a missing name", () => {
    const { name: _, ...rest } = sampleCharacterIdentity;
    expect(() => characterIdentitySchema.parse(rest)).toThrow();
  });

  it("rejects an empty name", () => {
    expect(() =>
      characterIdentitySchema.parse({ ...sampleCharacterIdentity, name: "" })
    ).toThrow();
  });

  it("rejects an empty activeLoadoutId", () => {
    expect(() =>
      characterIdentitySchema.parse({
        ...sampleCharacterIdentity,
        activeLoadoutId: ""
      })
    ).toThrow();
  });

  it("rejects unknown extra fields", () => {
    expect(() =>
      characterIdentitySchema.parse({ ...sampleCharacterIdentity, extra: true })
    ).toThrow();
  });
});
