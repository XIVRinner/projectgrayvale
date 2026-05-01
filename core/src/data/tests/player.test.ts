import { samplePlayer } from "../examples";
import { activityDefinitionSchema, playerSchema } from "../schemas";

describe("playerSchema", () => {
  it("accepts a valid player with skills", () => {
    expect(playerSchema.parse(samplePlayer)).toEqual(samplePlayer);
  });

  it("accepts seeded story state with empty activity availability", () => {
    expect(
      playerSchema.parse({
        ...samplePlayer,
        story: {
          currentArcId: "prologue",
          currentChapter: 1
        },
        activityState: {
          availability: {}
        }
      }).activityState
    ).toEqual({
      availability: {}
    });
  });

  it("accepts interaction state button press records", () => {
    expect(playerSchema.parse(samplePlayer).interactionState).toEqual(
      samplePlayer.interactionState
    );
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

  it("rejects button press payload values outside the supported scalar types", () => {
    expect(() =>
      playerSchema.parse({
        ...samplePlayer,
        interactionState: {
          totalButtonPresses: 1,
          lastButtonPress: {
            actionId: "bad-payload",
            actionKind: "test",
            occurredAt: "2026-05-01T00:00:00.000Z",
            payload: {
              invalid: {
                nested: true
              }
            }
          }
        }
      })
    ).toThrow();
  });
});

describe("activityDefinitionSchema", () => {
  it("parses a recover activity definition", () => {
    expect(
      activityDefinitionSchema.parse({
        id: "recover",
        name: "Recover",
        description: "Attempt to regain your footing while still injured.",
        tags: ["recovery"],
        governingAttributes: ["vitality"],
        difficulty: 5
      })
    ).toEqual({
      id: "recover",
      name: "Recover",
      description: "Attempt to regain your footing while still injured.",
      tags: ["recovery"],
      governingAttributes: ["vitality"],
      difficulty: 5
    });
  });
});
