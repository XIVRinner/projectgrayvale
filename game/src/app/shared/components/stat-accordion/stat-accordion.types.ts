export type StatAccordionVariant = "attribute" | "skill";

export interface StatAccordionItem {
  readonly abbreviation: string;
  readonly label: string;
  readonly value: number;
  readonly isLocked: boolean;
  readonly tags?: readonly string[];
}
