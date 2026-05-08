import type { InventoryEquipmentItem, Player } from "@rinner/grayvale-core";

export interface EquipmentRequirementCheck {
  readonly canEquip: boolean;
  readonly reason: string | null;
}

export interface EquipmentRequirementStatus {
  readonly label: string;
  readonly met: boolean;
}

export function checkEquipmentRequirements(
  player: Player | null,
  item: InventoryEquipmentItem
): EquipmentRequirementCheck {
  const statuses = buildEquipmentRequirementStatuses(player, item);

  const unmetRequirement = statuses.find((status) => !status.met);
  if (unmetRequirement) {
    return {
      canEquip: false,
      reason: `${unmetRequirement.label}.`
    };
  }

  return {
    canEquip: true,
    reason: null
  };
}

export function buildEquipmentRequirementStatuses(
  player: Player | null,
  item: InventoryEquipmentItem
): readonly EquipmentRequirementStatus[] {
  const statuses: EquipmentRequirementStatus[] = [];

  if (!player) {
    if (typeof item.requirements?.levelRequirement === "number") {
      statuses.push({
        label: `Requires level ${item.requirements.levelRequirement}`,
        met: false
      });
    }

    if (item.requirements?.skillRequirement) {
      statuses.push({
        label: `Requires ${prettyLabel(item.requirements.skillRequirement.skillId)} ${item.requirements.skillRequirement.level}`,
        met: false
      });
    }

    return statuses;
  }

  const levelRequirement = item.requirements?.levelRequirement;
  if (typeof levelRequirement === "number") {
    statuses.push({
      label: `Requires level ${levelRequirement}`,
      met: player.progression.level >= levelRequirement
    });
  }

  const skillRequirement = item.requirements?.skillRequirement;
  if (skillRequirement) {
    const currentSkillLevel = player.skills[skillRequirement.skillId] ?? 0;
    statuses.push({
      label: `Requires ${prettyLabel(skillRequirement.skillId)} ${skillRequirement.level}`,
      met: currentSkillLevel >= skillRequirement.level
    });
  }

  return statuses;
}

function prettyLabel(value: string): string {
  return value
    .split(/[_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
