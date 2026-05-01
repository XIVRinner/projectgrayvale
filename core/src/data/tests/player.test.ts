import { samplePlayer } from "../examples";
import { playerSchema } from "../schemas";

describe("playerSchema", () => {
  it("accepts a valid player with skills", () => {
    expect(playerSchema.parse(samplePlayer)).toEqual(samplePlayer);
  });

  it("rejects invalid skill values", () => {
    expect(() =>
      playerSchema.parse({
        ...samplePlayer,
        skills: {
          short_blade: "high"
        }
      })
    ).toThrow();
  });

  it("rejects malformed structure", () => {
    expect(() =>
      playerSchema.parse({
        ...samplePlayer,
        inventory: []
      })
    ).toThrow();
  });
});
