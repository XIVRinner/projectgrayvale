import type { InventoryEquipmentItem, Player } from "@rinner/grayvale-core";

export interface EquipmentRequirementCheck {
  readonly canEquip: boolean;
  readonly reason: string | null;
}

export function checkEquipmentRequirements(
  player: Player | null,
  item: InventoryEquipmentItem
): EquipmentRequirementCheck {
  if (!player) {
    return {
      canEquip: false,
      reason: "No active character."
    };
  }

  const levelRequirement = item.requirements?.levelRequirement;

  if (
    typeof levelRequirement === "number" &&
    player.progression.level < levelRequirement
  ) {
    return {
      canEquip: false,
      reason: `Requires level ${levelRequirement}.`
    };
  }

  const skillRequirement = item.requirements?.skillRequirement;

  if (skillRequirement) {
    const currentSkillLevel = player.skills[skillRequirement.skillId] ?? 0;

    if (currentSkillLevel < skillRequirement.level) {
      return {
        canEquip: false,
        reason: `Requires ${prettyLabel(skillRequirement.skillId)} ${skillRequirement.level}.`
      };
    }
  }

  return {
    canEquip: true,
    reason: null
  };
}

function prettyLabel(value: string): string {
  return value
    .split(/[_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
