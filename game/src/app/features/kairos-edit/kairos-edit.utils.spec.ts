import {
  createEditorState,
  createDefaultDefinition,
  readStringArrayValue,
  validateDefinitionDraft,
  validateTagRegistryDraft,
} from "./kairos-edit.utils";

describe("validateDefinitionDraft", () => {
  it("warns before overwriting an existing id and rejects unknown tags", () => {
    const state = {
      ...createEditorState(),
      ids: ["weapon_dagger_rustleaf"],
      definition: {
        ...createDefaultDefinition("items"),
        id: "weapon_dagger_rustleaf",
        name: "Old Dagger",
        tags: ["unknown_tag"],
      },
    };

    expect(
      validateDefinitionDraft("items", state, [
        {
          id: "starter",
          label: "Starter",
          description: "Starter",
          categoryId: "inventory",
          categoryLabel: "Inventory",
        },
      ]),
    ).toEqual({
      errors: ["Unknown tags selected: unknown_tag."],
      warnings: [
        'Saving will overwrite the existing items definition "weapon_dagger_rustleaf".',
      ],
    });
  });
});

describe("readStringArrayValue", () => {
  it("preserves the original array reference when every entry is already a string", () => {
    const tags = ["starter", "quest"] as string[];
    const definition = {
      ...createDefaultDefinition("items"),
      tags,
    };

    expect(readStringArrayValue(definition, ["tags"])).toBe(tags);
  });
});

describe("validateTagRegistryDraft", () => {
  it("rejects case-insensitive duplicate category/tag ids", () => {
    expect(
      validateTagRegistryDraft({
        categories: [
          {
            id: "world_context",
            label: "World Context",
            description: "",
            allowedFor: ["locations"],
            tags: [{ id: "camp", label: "Camp", description: "" }],
          },
          {
            id: "World_Context",
            label: "Duplicate",
            description: "",
            allowedFor: ["locations"],
            tags: [{ id: "Camp", label: "Camp duplicate", description: "" }],
          },
        ],
      }).errors,
    ).toEqual([
      "Category id \"World_Context\" must use lowercase letters, numbers, underscores, or hyphens.",
      "Duplicate category id (case-insensitive): world_context / World_Context",
      "Tag id \"Camp\" must use lowercase letters, numbers, underscores, or hyphens.",
      "Duplicate tag id (case-insensitive): camp / Camp",
    ]);
  });
});
