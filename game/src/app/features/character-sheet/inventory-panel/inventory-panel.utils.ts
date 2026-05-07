import type { ItemCategory } from "@rinner/grayvale-core";

import type { InventoryPanelCategory, InventoryPanelItemView } from "./inventory-panel.types";

export const filterInventoryItems = (
  items: readonly InventoryPanelItemView[],
  category: InventoryPanelCategory,
  normalizedSearch: string
): readonly InventoryPanelItemView[] => {
  const search = normalizedSearch.trim();

  return items.filter((item) => {
    const categoryMatch = category === "all" || item.category === category;
    if (!categoryMatch) return false;
    if (!search) return true;

    return item.searchTerms.some((term) => term.includes(search));
  });
};

export const buildCategoryCounts = (
  items: readonly InventoryPanelItemView[]
): Readonly<Record<InventoryPanelCategory, number>> => {
  const counts: Record<InventoryPanelCategory, number> = {
    all: items.length,
    equipment: 0,
    material: 0,
    quest_item: 0,
    junk: 0
  };

  for (const item of items) {
    counts[item.category as ItemCategory]++;
  }

  return counts;
};

export const toQualityStars = (qualityStars: number | null): string =>
  qualityStars && qualityStars > 0 ? "★".repeat(qualityStars) : "";
