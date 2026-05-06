import type { CharacterIdentity } from "../../core/models";

export const sampleCharacterIdentity: CharacterIdentity = {
  id: "char_lyra_dawnmere",
  name: "Lyra Dawnmere",
  raceId: "race_human",
  genderId: "type-1",
  level: 3,
  classId: "wanderer",
  tags: ["humanoid"],
  activeLoadoutId: "loadout_default",
  inventory: {
    items: {
      weapon_dagger_rustleaf: 1,
      armor_hood_rainwoven: 1,
      potion_minor_healing: 3,
      ration_standard: 5
    }
  }
};

export const sampleCharacterIdentityNoRank: CharacterIdentity = {
  id: "char_lyra_dawnmere",
  name: "Lyra Dawnmere",
  raceId: "race_human",
  level: 1,
  tags: [],
  activeLoadoutId: "loadout_default",
  inventory: { items: {} }
};
