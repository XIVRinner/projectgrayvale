import {
  sampleEquipmentItem,
  samplePlayer,
  type InventoryEquipmentItem,
  type Player
} from "@rinner/grayvale-core";

import { checkEquipmentRequirements } from "./character-sheet-equipment-requirements";

describe("checkEquipmentRequirements", () => {
  it("rejects equipment when the player level is below the requirement", () => {
    const player: Player = {
      ...clone(samplePlayer),
      progression: {
        ...samplePlayer.progression,
        level: 1
      }
    };
    const item: InventoryEquipmentItem = {
      ...clone(sampleEquipmentItem),
      requirements: {
        levelRequirement: 5
      }
    };

    expect(checkEquipmentRequirements(player, item)).toEqual({
      canEquip: false,
      reason: "Requires level 5."
    });
  });

  it("rejects equipment when the required skill is too low", () => {
    const player: Player = {
      ...clone(samplePlayer),
      skills: {
        ...samplePlayer.skills,
        short_blade: 1
      }
    };
    const item: InventoryEquipmentItem = {
      ...clone(sampleEquipmentItem),
      requirements: {
        skillRequirement: {
          skillId: "short_blade",
          level: 3
        }
      }
    };

    expect(checkEquipmentRequirements(player, item)).toEqual({
      canEquip: false,
      reason: "Requires Short Blade 3."
    });
  });

  it("allows equipment when all requirements are met", () => {
    const player: Player = {
      ...clone(samplePlayer),
      progression: {
        ...samplePlayer.progression,
        level: 10
      },
      skills: {
        ...samplePlayer.skills,
        short_blade: 4
      }
    };
    const item: InventoryEquipmentItem = {
      ...clone(sampleEquipmentItem),
      requirements: {
        levelRequirement: 5,
        skillRequirement: {
          skillId: "short_blade",
          level: 3
        }
      }
    };

    expect(checkEquipmentRequirements(player, item)).toEqual({
      canEquip: true,
      reason: null
    });
  });
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
