import type { ExperienceConfig } from "../../core/models";

export function calculateXpRequired(level: number, config: ExperienceConfig): number {
  if (level <= 0) {
    throw new Error("Level must be greater than 0.");
  }

  return config.baseXp * Math.pow(level, config.exponent) * config.growthFactor;
}
