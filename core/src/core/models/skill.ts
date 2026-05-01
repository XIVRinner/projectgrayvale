import type { Entity, Named } from "./base";

export interface Skill extends Entity, Named {
  tags: string[];
  experience?: number;
  maxLevel?: number;
}
