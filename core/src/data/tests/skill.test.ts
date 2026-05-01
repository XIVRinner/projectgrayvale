import { skillSchema } from "../schemas";

describe("skillSchema", () => {
  it("accepts a valid skill", () => {
    expect(
      skillSchema.parse({
        id: "short_blade",
        name: "Short Blade",
        tags: ["combat", "melee"]
      })
    ).toEqual({
      id: "short_blade",
      name: "Short Blade",
      tags: ["combat", "melee"]
    });
  });

  it("rejects empty tags", () => {
    expect(() =>
      skillSchema.parse({
        id: "short_blade",
        name: "Short Blade",
        tags: []
      })
    ).toThrow();
  });

  it("rejects missing id", () => {
    expect(() =>
      skillSchema.parse({
        name: "Short Blade",
        tags: ["combat"]
      })
    ).toThrow();
  });

  it("rejects wrong field types", () => {
    expect(() =>
      skillSchema.parse({
        id: 42,
        name: "Short Blade",
        tags: ["combat"]
      })
    ).toThrow();
  });
});
