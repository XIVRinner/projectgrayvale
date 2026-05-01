import type { Modifier } from "../modifiers";

export interface Talent {
  id: string;
  name: string;
  modifiers: Modifier[];
}