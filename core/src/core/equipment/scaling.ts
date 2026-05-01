import type { Player } from "../models";
import type { EquipmentItem } from "./equipment.types";

export const computeItemScaling = (
  player: Player,
  item: EquipmentItem
): number => {
  const scaling = item.scaling;

  if (!scaling) {
    return 1;
  }

  const skillFactor = scaling.factors?.skills ?? 1;
  const attributeFactor = scaling.factors?.attributes ?? 1;
  const totalSkill = scaling.skills.reduce(
    (total, skill) => total + (player.skills[skill] ?? 0),
    0
  );
  const totalAttributes = (scaling.attributes ?? []).reduce(
    (total, attribute) => total + (player.attributes[attribute] ?? 0),
    0
  );

  return Math.max(0, totalSkill * skillFactor + totalAttributes * attributeFactor);
};
