import { experienceConfigSchema, experienceConfigSetSchema } from "../schemas";

describe("experienceConfigSchema", () => {
  it("accepts a valid config", () => {
    expect(
      experienceConfigSchema.parse({
        baseXp: 100,
        growthFactor: 1.2,
        exponent: 1.35
      })
    ).toEqual({
      baseXp: 100,
      growthFactor: 1.2,
      exponent: 1.35
    });
  });

  it("rejects invalid config values", () => {
    expect(() =>
      experienceConfigSchema.parse({
        baseXp: -100,
        growthFactor: 1.2,
        exponent: 1.35
      })
    ).toThrow();
  });

  it("rejects missing fields", () => {
    expect(() =>
      experienceConfigSchema.parse({
        baseXp: 100,
        exponent: 1.35
      })
    ).toThrow();
  });

  it("accepts multiple named configs", () => {
    expect(
      experienceConfigSetSchema.parse({
        easy: {
          baseXp: 100,
          growthFactor: 1,
          exponent: 1.1
        },
        hard: {
          baseXp: 100,
          growthFactor: 1.5,
          exponent: 1.6
        }
      })
    ).toEqual({
      easy: {
        baseXp: 100,
        growthFactor: 1,
        exponent: 1.1
      },
      hard: {
        baseXp: 100,
        growthFactor: 1.5,
        exponent: 1.6
      }
    });
  });
});
