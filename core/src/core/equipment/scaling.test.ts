import type { Player } from "../models";
import type { Armor } from "./armor";
import type { EquipmentItem } from "./equipment.types";
import type { Weapon } from "./weapon";
import { computeItemScaling } from "./scaling";

const createPlayer = (): Player => ({
  id: "player_scaling_test",
  name: "Scaling Test Player",
  description: "A player used for scaling tests.",
  raceId: "race_human",
  jobClass: "wanderer",
  progression: {
    level: 1,
    experience: 0
  },
  adventurerRank: 1,
  attributes: {
    strength: 6,
    agility: 4,
    vitality: 3
  },
  skills: {
    swordsmanship: 5,
    defense_training: 2
  },
  inventory: {
    items: {}
  },
  equippedItems: {}
});

describe("computeItemScaling", () => {
  it("returns 1 for an item with no scaling", () => {
    const item: Weapon = {
      id: "weapon_plain_blade",
      name: "Plain Blade",
      rarity: "common",
      icon: "assets/icons/weapons/plain-blade.png",
      type: "weapon",
      handedness: "oneHanded",
      class: "blade",
      subclass: "shortsword",
      allowedSlots: ["mainHand"]
    };

    expect(computeItemScaling(createPlayer(), item)).toBe(1);
  });

  it("computes scaling from multiple skills only", () => {
    const item: Weapon = {
      id: "weapon_duelist_blade",
      name: "Duelist Blade",
      rarity: "uncommon",
      icon: "assets/icons/weapons/duelist-blade.png",
      type: "weapon",
      handedness: "oneHanded",
      class: "blade",
      subclass: "longsword",
      allowedSlots: ["mainHand"],
      scaling: {
        skills: ["swordsmanship", "defense_training"],
        attributes: [],
        factors: {
          skills: 1.5
        }
      }
    };

    expect(computeItemScaling(createPlayer(), item)).toBe(10.5);
  });

  it("defaults missing skills to zero", () => {
    const item: Weapon = {
      id: "weapon_partial_training",
      name: "Partial Training Weapon",
      rarity: "uncommon",
      icon: "assets/icons/weapons/partial-training.png",
      type: "weapon",
      handedness: "oneHanded",
      class: "blade",
      subclass: "dagger",
      allowedSlots: ["mainHand"],
      scaling: {
        skills: ["swordsmanship", "missing_skill"],
        attributes: [],
        factors: {
          skills: 2
        }
      }
    };

    expect(computeItemScaling(createPlayer(), item)).toBe(10);
  });

  it("supports empty attributes", () => {
    const item: Armor = {
      id: "armor_skillbound_cap",
      name: "Skillbound Cap",
      rarity: "common",
      icon: "assets/icons/armor/skillbound-cap.png",
      type: "armor",
      armorType: "light",
      slot: "head",
      allowedSlots: ["head"],
      scaling: {
        skills: ["defense_training"]
      }
    };

    expect(computeItemScaling(createPlayer(), item)).toBe(2);
  });

  it("computes scaling from attributes only", () => {
    const item: Armor = {
      id: "armor_guard_plate",
      name: "Guard Plate",
      rarity: "rare",
      icon: "assets/icons/armor/guard-plate.png",
      type: "armor",
      armorType: "heavy",
      slot: "body",
      allowedSlots: ["body"],
      scaling: {
        skills: ["missing_skill"],
        attributes: ["strength", "vitality"],
        factors: {
          attributes: 0.5
        }
      }
    };

    expect(computeItemScaling(createPlayer(), item)).toBe(4.5);
  });

  it("computes scaling from both skills and attributes", () => {
    const item: Weapon = {
      id: "weapon_balanced_edge",
      name: "Balanced Edge",
      rarity: "rare",
      icon: "assets/icons/weapons/balanced-edge.png",
      type: "weapon",
      handedness: "oneHanded",
      class: "blade",
      subclass: "longsword",
      allowedSlots: ["mainHand"],
      scaling: {
        skills: ["swordsmanship", "defense_training"],
        attributes: ["strength", "agility"],
        factors: {
          skills: 2,
          attributes: 0.25
        }
      }
    };

    expect(computeItemScaling(createPlayer(), item)).toBe(16.5);
  });

  it("clamps negative scaling results to zero", () => {
    const item: Weapon = {
      id: "weapon_cursed_edge",
      name: "Cursed Edge",
      rarity: "cursed",
      icon: "assets/icons/weapons/cursed-edge.png",
      type: "weapon",
      handedness: "oneHanded",
      class: "blade",
      subclass: "dagger",
      allowedSlots: ["mainHand"],
      scaling: {
        skills: ["swordsmanship", "defense_training"],
        attributes: ["strength"],
        factors: {
          skills: -2,
          attributes: 0
        }
      }
    };

    expect(computeItemScaling(createPlayer(), item)).toBe(0);
  });
});

describe("armor typing", () => {
  it("supports armor as equipment data", () => {
    const armor: Armor = {
      id: "armor_stitched_hood",
      name: "Stitched Hood",
      rarity: "common",
      icon: "assets/icons/armor/stitched-hood.png",
      type: "armor",
      armorType: "light",
      slot: "head",
      allowedSlots: ["head"],
      tags: ["cloth"]
    };

    const equipmentItem: EquipmentItem = armor;

    expect(armor.type).toBe("armor");
    expect(armor.slot).toBe("head");
    expect(equipmentItem.allowedSlots).toEqual(["head"]);
  });
});
