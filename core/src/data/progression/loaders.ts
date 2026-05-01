import type { ExperienceConfig } from "../../core/models";
import { experienceConfigSchema, experienceConfigSetSchema } from "../schemas";

export function loadExperienceConfig(data: unknown): ExperienceConfig {
  return experienceConfigSchema.parse(data);
}

export function loadExperienceConfigSet(data: unknown): Record<string, ExperienceConfig> {
  return experienceConfigSetSchema.parse(data);
}
