import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { RARITY_DEFINITIONS, type InventoryItemDefinition } from "@rinner/grayvale-core";

import type {
  ItemTooltipBaseRarity,
  ItemTooltipSpecialRarity,
  ItemTooltipVariant
} from "./item-tooltip.types";
import { EquipmentTooltipBodyComponent } from "./sub-pieces/equipment-tooltip-body.component";
import { MaterialTooltipBodyComponent } from "./sub-pieces/material-tooltip-body.component";
import { QuestTooltipBodyComponent } from "./sub-pieces/quest-tooltip-body.component";
import { JunkTooltipBodyComponent } from "./sub-pieces/junk-tooltip-body.component";

type ItemTooltipSpecialSection = Readonly<{
  id: ItemTooltipSpecialRarity;
  title: string;
  detail: string;
  severity: "critical" | "high" | "medium";
}>;

const BASE_RARITY_LABELS: Readonly<Record<ItemTooltipBaseRarity, string>> = {
  junk: "Junk",
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  ephemeral: "Ephemeral",
  mythical: "Mythical",
  primal: "Primal"
};

const LEGENDARY_SECTIONS: Readonly<
  Record<ItemTooltipBaseRarity, Readonly<{ title: string; detail: string } | null>>
> = {
  junk: null,
  common: null,
  uncommon: null,
  rare: null,
  epic: null,
  legendary: {
    title: "Legendary Effect",
    detail: "Distinct legendary effect roll. Gold/orange frame treatment."
  },
  ephemeral: {
    title: "Legendary Effect (Maximized)",
    detail: "Spectral gold frame; legendary effect is locked at maximum value."
  },
  mythical: {
    title: "Mythical Calibration",
    detail: "Violet/gold ornate treatment; legendary effect and all rolls are maxed."
  },
  primal: {
    title: "Primal Bonus",
    detail: "Ancient red/gold/white treatment with a primal bonus block."
  }
};

const SPECIAL_SECTION_DETAILS: Readonly<Record<ItemTooltipSpecialRarity, ItemTooltipSpecialSection>> = {
  cursed: {
    id: "cursed",
    title: "Cursed",
    detail: "Warning treatment with cracked red/black overlay.",
    severity: "critical"
  },
  divine: {
    id: "divine",
    title: "Divine",
    detail: "White/gold sacred glow treatment.",
    severity: "medium"
  },
  infernal: {
    id: "infernal",
    title: "Infernal",
    detail: "Heat-forward treatment with burning edge cues.",
    severity: "high"
  },
  phantom: {
    id: "phantom",
    title: "Phantom",
    detail: "Translucent ghosted frame with remaining uses displayed prominently.",
    severity: "critical"
  },
  temporal: {
    id: "temporal",
    title: "Temporal",
    detail: "Time/rift motif with context restriction surfaced first.",
    severity: "critical"
  },
  secret: {
    id: "secret",
    title: "Secret",
    detail: "Hidden glyph and mystery treatment to mark discovery status.",
    severity: "high"
  },
  galvanized: {
    id: "galvanized",
    title: "Galvanized",
    detail: "Electric charged overlay with activity allowed/blocked state emphasis.",
    severity: "critical"
  }
};

const SPECIAL_RARITY_IDS: readonly ItemTooltipSpecialRarity[] = [
  "cursed",
  "divine",
  "infernal",
  "phantom",
  "temporal",
  "secret",
  "galvanized"
];

const BASE_RARITY_IDS: readonly ItemTooltipBaseRarity[] = [
  "junk",
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "ephemeral",
  "mythical",
  "primal"
];

const LEGACY_SPECIAL_BASE_RARITIES = ["divine", "infernal", "cursed"] as const;

@Component({
  selector: "gv-item-tooltip",
  standalone: true,
  imports: [
    EquipmentTooltipBodyComponent,
    MaterialTooltipBodyComponent,
    QuestTooltipBodyComponent,
    JunkTooltipBodyComponent
  ],
  templateUrl: "./item-tooltip.component.html",
  styleUrls: ["./item-tooltip.component.scss", "./item-tooltip.variants.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ItemTooltipComponent {
  readonly item = input.required<InventoryItemDefinition>();
  readonly baseRarity = input<ItemTooltipBaseRarity | null>(null);
  readonly specialRarities = input<readonly ItemTooltipSpecialRarity[] | null>(null);

  protected readonly variant = computed((): ItemTooltipVariant => {
    switch (this.item().category) {
      case "equipment":
        return "equipment";
      case "material":
        return "material";
      case "quest_item":
        return "quest";
      case "junk":
        return "junk";
    }
  });

  protected readonly resolvedBaseRarity = computed((): ItemTooltipBaseRarity => {
    const explicitBase = this.baseRarity();
    if (explicitBase) return explicitBase;

    const itemRarity = this.item().rarity;
    if (itemRarity === "trash") return "junk";
    // Legacy core model can encode these as top-level rarity values instead of
    // base rarity + special rarity; "epic" keeps them in a non-legendary base tier.
    if ((LEGACY_SPECIAL_BASE_RARITIES as readonly string[]).includes(itemRarity)) {
      return "epic";
    }
    return this.isBaseRarity(itemRarity) ? itemRarity : "common";
  });

  protected readonly resolvedSpecialRarities = computed((): readonly ItemTooltipSpecialRarity[] => {
    const explicitSpecials = this.specialRarities();
    if (explicitSpecials) return Array.from(new Set(explicitSpecials));

    const derivedSpecials = new Set<ItemTooltipSpecialRarity>();
    const itemRarity = this.item().rarity;
    if (this.isSpecialRarity(itemRarity)) {
      derivedSpecials.add(itemRarity);
    }
    const itemSpecialRarity = this.item().specialRarity;
    if (itemSpecialRarity && this.isSpecialRarity(itemSpecialRarity)) {
      derivedSpecials.add(itemSpecialRarity);
    }
    return Array.from(derivedSpecials);
  });

  protected readonly rarityColor = computed(
    (): string => RARITY_DEFINITIONS[this.item().rarity]?.color ?? RARITY_DEFINITIONS.common.color
  );

  protected readonly rarityName = computed((): string => BASE_RARITY_LABELS[this.resolvedBaseRarity()]);
  protected readonly legendarySection = computed(() => LEGENDARY_SECTIONS[this.resolvedBaseRarity()]);
  protected readonly specialSections = computed(
    (): readonly ItemTooltipSpecialSection[] =>
      this.resolvedSpecialRarities().map((special) => SPECIAL_SECTION_DETAILS[special])
  );
  protected readonly primarySpecialRarity = computed(
    (): ItemTooltipSpecialRarity | null => this.resolvedSpecialRarities().at(0) ?? null
  );
  protected readonly hasCriticalSpecialSection = computed(() =>
    this.specialSections().some((section) => section.severity === "critical")
  );

  protected readonly equipmentItem = computed(() => {
    const item = this.item();
    return item.category === "equipment" ? item : null;
  });

  protected readonly materialItem = computed(() => {
    const item = this.item();
    return item.category === "material" ? item : null;
  });

  protected readonly questItem = computed(() => {
    const item = this.item();
    return item.category === "quest_item" ? item : null;
  });

  protected readonly junkItem = computed(() => {
    const item = this.item();
    return item.category === "junk" ? item : null;
  });

  private isSpecialRarity(value: string): value is ItemTooltipSpecialRarity {
    return (SPECIAL_RARITY_IDS as readonly string[]).includes(value);
  }

  private isBaseRarity(value: string): value is ItemTooltipBaseRarity {
    return (BASE_RARITY_IDS as readonly string[]).includes(value);
  }
}
