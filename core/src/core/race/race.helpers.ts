import type { Race, RaceVariant } from "./race.types";

export const getRaceImagePath = (
  race: Race,
  variant: RaceVariant,
  index: number
): string => {
  const normalizedBasePath = race.imageBasePath.replace(/\/+$/, "");

  return `${normalizedBasePath}/${variant}/${index}.png`;
};