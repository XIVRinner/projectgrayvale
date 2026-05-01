import type { Player } from "../models";
import { canEquip, equip, unequip } from "./equip";
import type { Armor } from "./armor";
import type { EquippableItem } from "./equip.types";

const createPlayer = (): Player => ({
  id: "player_test",
  name: "Test Player",
  description: "Equipment test player",
  raceId: "race_human",
  jobClass: "wanderer",
  progression: {
    level: 1,
    experience: 0
  },
  adventurerRank: 1,
  attributes: {
    strength: 5
  },
  skills: {},
  inventory: {
    items: {}
  },
  equippedItems: {
    mainHand: "weapon_old_blade",
    offHand: "shield_old_guard",
    head: "armor_old_cap"
  }
});

const oneHandedWeapon: EquippableItem = {
  id: "weapon_iron_sword",
  name: "Iron Sword",
  rarity: "common",
  icon: "assets/icons/weapons/iron-sword.png",
  type: "weapon",
  handedness: "oneHanded",
  class: "blade",
  subclass: "longsword",
  allowedSlots: ["mainHand"]
};

const offHandWeapon: EquippableItem = {
  id: "weapon_parrying_dagger",
  name: "Parrying Dagger",
  rarity: "uncommon",
  icon: "assets/icons/weapons/parrying-dagger.png",
  type: "weapon",
  handedness: "oneHanded",
  class: "blade",
  subclass: "dagger",
  allowedSlots: ["offHand"]
};

const twoHandedWeapon: EquippableItem = {
  id: "weapon_longbow",
  name: "Longbow",
  rarity: "rare",
  icon: "assets/icons/weapons/longbow.png",
  type: "weapon",
  handedness: "twoHanded",
  class: "ranged",
  subclass: "bow",
  allowedSlots: ["mainHand"]
};

const headArmor: Armor = {
  id: "armor_iron_helm",
  name: "Iron Helm",
  rarity: "common",
  icon: "assets/icons/armor/iron-helm.png",
  type: "armor",
  armorType: "heavy",
  slot: "head",
  allowedSlots: ["head"],
  tags: ["plate"]
};

describe("equipment actions", () => {
  it("equips a one-handed weapon to mainHand", () => {
    const player = createPlayer();

    const updatedPlayer = equip(player, oneHandedWeapon, "mainHand");

    expect(updatedPlayer.equippedItems.mainHand).toBe(oneHandedWeapon.id);
    expect(updatedPlayer.equippedItems.offHand).toBe(player.equippedItems.offHand);
  });

  it("equips armor to its supported slot", () => {
    const player = createPlayer();

    const updatedPlayer = equip(player, headArmor, "head");

    expect(updatedPlayer.equippedItems.head).toBe(headArmor.id);
    expect(updatedPlayer.equippedItems.mainHand).toBe(player.equippedItems.mainHand);
  });

  it("equipping a two-handed weapon to mainHand clears offHand", () => {
    const player = createPlayer();

    const updatedPlayer = equip(player, twoHandedWeapon, "mainHand");

    expect(updatedPlayer.equippedItems.mainHand).toBe(twoHandedWeapon.id);
    expect(updatedPlayer.equippedItems.offHand).toBeUndefined();
  });

  it("cannot equip a two-handed weapon to offHand", () => {
    const player = createPlayer();

    expect(canEquip(player, twoHandedWeapon, "offHand")).toBe(false);
    expect(() => equip(player, twoHandedWeapon, "offHand")).toThrow(
      `Cannot equip two-handed item "${twoHandedWeapon.id}" to offHand.`
    );
  });

  it("cannot equip an item to an invalid slot", () => {
    const player = createPlayer();
    const invalidSlot = "ring" as unknown as "mainHand";

    expect(canEquip(player, offHandWeapon, invalidSlot)).toBe(false);
    expect(() => equip(player, offHandWeapon, invalidSlot)).toThrow(
      `Cannot equip item "${offHandWeapon.id}" to unsupported slot "ring".`
    );
  });

  it("unequip removes an item safely", () => {
    const player = createPlayer();

    const updatedPlayer = unequip(player, "offHand");

    expect(updatedPlayer.equippedItems.offHand).toBeUndefined();
    expect(updatedPlayer.equippedItems.mainHand).toBe(player.equippedItems.mainHand);
    expect(updatedPlayer.equippedItems.head).toBe(player.equippedItems.head);
  });

  it("does not mutate the original player", () => {
    const player = createPlayer();

    const updatedPlayer = equip(player, oneHandedWeapon, "mainHand");

    expect(updatedPlayer).not.toBe(player);
    expect(updatedPlayer.equippedItems).not.toBe(player.equippedItems);
    expect(player.equippedItems.mainHand).toBe("weapon_old_blade");
    expect(player.equippedItems.offHand).toBe("shield_old_guard");
    expect(player.equippedItems.head).toBe("armor_old_cap");
  });
});
