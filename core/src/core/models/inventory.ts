import type { Id } from "./base";

export interface Inventory {
  items: Record<Id, number>;
}
