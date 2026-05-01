import type { ExperienceConfig } from "../../core/models";

export const easyExperienceConfig: ExperienceConfig = {
  baseXp: 100,
  growthFactor: 1,
  exponent: 1.1
};

export const normalExperienceConfig: ExperienceConfig = {
  baseXp: 100,
  growthFactor: 1.2,
  exponent: 1.35
};

export const hardExperienceConfig: ExperienceConfig = {
  baseXp: 100,
  growthFactor: 1.5,
  exponent: 1.6
};

export const experienceConfigs: Record<string, ExperienceConfig> = {
  easy: easyExperienceConfig,
  normal: normalExperienceConfig,
  hard: hardExperienceConfig
};
