import type { Id } from "./base";
import type { Inventory } from "./inventory";

export interface CharacterIdentity {
  id: Id;
  name: string;
  raceId: string;
  /** Display-only for MVP. */
  genderId?: string;
  level: number;
  /** Optional class or archetype. */
  classId?: string;
  /** Optional — not yet unlocked at the start of the game. */
  adventurerRank?: number;
  /** Combat-relevant tags. Race-derived tags (e.g. 'elf', 'humanoid') are merged in at runtime. */
  tags: string[];
  activeLoadoutId: string;
  inventory: Inventory;
}
