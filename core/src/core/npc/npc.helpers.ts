import type { CombatNPC, NPC, NonCombatNPC } from "./npc.types";

export const getTrustThreshold = (starLevel: number): number => {
  if (!Number.isInteger(starLevel) || starLevel < 1) {
    throw new RangeError("starLevel must be an integer greater than or equal to 1.");
  }

  return 100 * (2 ** (starLevel - 1));
};

export const isCombatNPC = (npc: NPC): npc is CombatNPC =>
  npc.type === "combat";

export const isNonCombatNPC = (npc: NPC): npc is NonCombatNPC =>
  npc.type === "noncombat";

export const assertValidNPC = (npc: NPC): void => {
  if (isCombatNPC(npc)) {
    if (npc.role && npc.availableRoles && !npc.availableRoles.includes(npc.role)) {
      throw new Error("NPC role must be included in availableRoles.");
    }

    return;
  }

  if (npc.availableRoles) {
    throw new Error("availableRoles is only valid for combat NPCs.");
  }

  if (npc.equipment) {
    throw new Error("equipment is only valid for combat NPCs.");
  }
};
