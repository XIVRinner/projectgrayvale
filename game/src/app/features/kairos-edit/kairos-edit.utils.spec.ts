import { createEditorState, createDefaultDefinition, validateDefinitionDraft } from "./kairos-edit.utils";

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
