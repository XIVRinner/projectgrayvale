import type { DefinitionApiType } from "../../data/api-paths";

export type KairosDefinitionType = DefinitionApiType;
export type KairosPathSegment = string | number;
export type KairosFieldPath = readonly KairosPathSegment[];
export type KairosTagTarget =
  | "items"
  | "materials"
  | "locations"
  | "sublocations"
  | "activities"
  | "actions";

export interface KairosTagRegistryTag {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export interface KairosTagRegistryCategory {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly allowedFor: readonly KairosTagTarget[];
  readonly tags: readonly KairosTagRegistryTag[];
}

export interface KairosTagRegistry {
  readonly categories: readonly KairosTagRegistryCategory[];
}

export interface KairosTagOption {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly categoryId: string;
  readonly categoryLabel: string;
}

export interface KairosEditorState {
  readonly ids: readonly string[];
  readonly listItems: readonly KairosDefinitionListItem[];
  readonly selectedId: string | null;
  readonly definition: Record<string, unknown> | null;
  readonly jsonText: string;
  readonly jsonError: string | null;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly statusMessage: string | null;
  readonly validationErrors: readonly string[];
  readonly validationWarnings: readonly string[];
}

export interface KairosFieldChange {
  readonly path: KairosFieldPath;
  readonly value: unknown;
}

export interface KairosDefinitionListItem {
  readonly id: string;
  readonly label: string;
  readonly tags: readonly string[];
}

export interface KairosDefinitionWorkspaceView {
  readonly title: string;
  readonly description: string;
  readonly emptyLabel: string;
}

export const KAIROS_TABS: readonly {
  readonly id: KairosDefinitionType | "tags";
  readonly label: string;
  readonly description: string;
}[] = [
  {
    id: "items",
    label: "Items",
    description: "Create and update non-material inventory item definitions."
  },
  {
    id: "materials",
    label: "Materials",
    description: "Manage material definitions and their crafting-facing metadata."
  },
  {
    id: "locations",
    label: "Locations",
    description: "Edit world locations and nested sublocations without touching GEG data."
  },
  {
    id: "activities",
    label: "Activities",
    description: "Manage activity definitions, tags, and world availability."
  },
  {
    id: "actions",
    label: "Actions",
    description: "Manage non-combat action definitions and their costs/effects."
  },
  {
    id: "tags",
    label: "Tags",
    description: "View and edit the centralized tag registry used by all definition editors."
  }
] as const;

export const TAG_TARGET_OPTIONS: readonly { readonly value: KairosTagTarget; readonly label: string }[] = [
  { value: "items", label: "Items" },
  { value: "materials", label: "Materials" },
  { value: "locations", label: "Locations" },
  { value: "sublocations", label: "Sublocations" },
  { value: "activities", label: "Activities" },
  { value: "actions", label: "Actions" },
];

export const ITEM_CATEGORY_OPTIONS = [
  { label: "Equipment", value: "equipment" },
  { label: "Quest Item", value: "quest_item" },
  { label: "Junk", value: "junk" }
] as const;

export const RARITY_OPTIONS = [
  "trash",
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythical",
  "ephemeral",
  "primal",
  "divine",
  "infernal",
  "cursed"
].map((value) => ({ label: startCase(value), value })) as readonly {
  readonly label: string;
  readonly value: string;
}[];

export const SPECIAL_RARITY_OPTIONS = [
  { label: "None", value: "" },
  { label: "Legendary", value: "legendary" },
  { label: "Mythical", value: "mythical" },
  { label: "Ephemeral", value: "ephemeral" },
  { label: "Primal", value: "primal" },
  { label: "Divine", value: "divine" },
  { label: "Infernal", value: "infernal" },
  { label: "Cursed", value: "cursed" }
] as const;

export const ITEM_SLOT_OPTIONS = [
  "head",
  "chest",
  "gloves",
  "legs",
  "boots",
  "main_hand",
  "off_hand",
  "ring"
].map((value) => ({ label: startCase(value), value })) as readonly {
  readonly label: string;
  readonly value: string;
}[];

export const QUALITY_OPTIONS = [
  { label: "None", value: "" },
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 }
] as const;

function startCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .map((segment) =>
      segment.length > 0 ? `${segment[0]!.toUpperCase()}${segment.slice(1)}` : segment,
    )
    .join(" ");
}
