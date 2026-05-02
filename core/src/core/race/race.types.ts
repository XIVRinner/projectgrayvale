import type { Modifier } from "../modifiers";

export type RaceVariant = "warm" | "cool" | "exotic";

export interface Race {
  id: string;
  name: string;
  adjective: string;
  slug: string;
  imageBasePath: string;
  variants?: {
    warm?: string[];
    cool?: string[];
    exotic?: string[];
  };
  startingBonuses?: Modifier[];
}
