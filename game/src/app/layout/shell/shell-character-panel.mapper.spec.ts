import { samplePlayer, type Skill } from "@rinner/grayvale-core";

import type { CharacterStatUnlockState } from "../../core/services/character-roster.service";
import type { AttributeDefinition } from "../../data/loaders/attribute-definitions.loader";
import {
  buildShellCharacterPanel,
  type ShellCharacterMetadata
} from "./shell-character-panel.mapper";

describe("buildShellCharacterPanel", () => {
  it("defaults to only vitality unlocked and keeps all skills locked", () => {
    const panel = buildShellCharacterPanel(
      clonePlayer(samplePlayer),
      buildMetadata(),
      undefined,
      null,
      undefined,
      undefined
    );

    expect(panel.attributes).toEqual([
      expect.objectContaining({ abbreviation: "VIT", isLocked: false, value: 8 }),
      expect.objectContaining({ abbreviation: "STR", isLocked: true, value: 7 }),
      expect.objectContaining({ abbreviation: "AGI", isLocked: true, value: 10 }),
      expect.objectContaining({ abbreviation: "MEN", isLocked: true, value: 6 })
    ]);
    expect(panel.skills).toHaveLength(3);
    expect(panel.skills.every((skill) => skill.isLocked)).toBe(true);
    expect(panel.focusItems.find((item) => item.title === "Skills")?.detail).toBe("All skills locked");
    expect(panel.skills.some((skill) => skill.label === "Survival")).toBe(false);
  });

  it("reveals only the explicitly unlocked skills and attributes", () => {
    const panel = buildShellCharacterPanel(
      clonePlayer(samplePlayer),
      buildMetadata(),
      {
        attributes: {
          vitality: true,
          strength: true,
          agility: false,
          mentality: false
        },
        skills: {
          short_blade: true,
          bow: false,
          blacksmithing: false,
          survival: false
        }
      } satisfies CharacterStatUnlockState,
      null,
      undefined,
      undefined
    );

    expect(panel.attributes.find((attribute) => attribute.abbreviation === "STR")?.isLocked).toBe(false);
    expect(panel.skills.find((skill) => skill.label === "Short Blade")).toMatchObject({
      value: 2,
      isLocked: false
    });
    expect(panel.skills.find((skill) => skill.label === "Blacksmithing")).toMatchObject({
      value: 3,
      isLocked: true
    });
    expect(panel.skills.some((skill) => skill.label === "Survival")).toBe(false);
    expect(panel.focusItems.find((item) => item.title === "Skills")?.detail).toBe("Short Blade 2");
  });

  it("hides completely unknown skills", () => {
    const player = clonePlayer(samplePlayer);
    player.skills = {};

    const panel = buildShellCharacterPanel(
      player,
      buildMetadata(),
      undefined,
      null,
      undefined,
      undefined
    );

    expect(panel.skills).toEqual([]);
    expect(panel.focusItems.find((item) => item.title === "Skills")?.detail).toBe("No known skills");
  });
});

function buildMetadata(): ShellCharacterMetadata {
  const attributes: readonly AttributeDefinition[] = [
    {
      id: "vitality",
      name: "Vitality",
      abbreviation: "VIT",
      description: "Resilience, stamina, and physical staying power.",
      displayOrder: 1
    },
    {
      id: "strength",
      name: "Strength",
      abbreviation: "STR",
      description: "Raw force, burden handling, and direct physical pressure.",
      displayOrder: 2
    },
    {
      id: "agility",
      name: "Agility",
      abbreviation: "AGI",
      description: "Speed, finesse, and precision under motion.",
      displayOrder: 3
    },
    {
      id: "mentality",
      name: "Mentality",
      abbreviation: "MEN",
      description: "Focus, reasoning, and control of disciplined intent.",
      displayOrder: 4
    }
  ];
  const skills: readonly Skill[] = [
    {
      id: "short_blade",
      name: "Short Blade",
      description: "Training with daggers, knives, and compact edged weapons.",
      tags: ["combat", "melee"]
    },
    {
      id: "bow",
      name: "Bow",
      description: "Handling bows, distance control, and ranged accuracy.",
      tags: ["combat", "ranged"]
    },
    {
      id: "blacksmithing",
      name: "Blacksmithing",
      description: "Forging, tempering, and metalwork for tools and arms.",
      tags: ["general"]
    },
    {
      id: "survival",
      name: "Survival",
      description: "Fieldcraft, endurance, and self-sufficiency away from settlements.",
      tags: ["general"]
    }
  ];

  return {
    racesById: new Map(),
    classesById: new Map(),
    attributesById: new Map(attributes.map((attribute) => [attribute.id, attribute])),
    skillsById: new Map(skills.map((skill) => [skill.id, skill]))
  };
}

function clonePlayer<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
