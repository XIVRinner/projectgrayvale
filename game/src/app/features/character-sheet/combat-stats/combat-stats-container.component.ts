import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal
} from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { catchError, combineLatest, map, of } from "rxjs";

import { z } from "zod";

import {
  computeStatBreakdowns,
  inventoryEquipmentItemSchema,
  sampleLoadoutDefault,
  type InventoryEquipmentItem,
  type LabeledModifier,
  type Loadout,
  type StatBlock,
  type StatBreakdown
} from "@rinner/grayvale-core";

// GAP: statBlockSchema
// Blocked on: @rinner/grayvale-core
// Needs: a Zod schema for StatBlock (Record<string, number>) exported from modifier.types
// Do not implement until: StatBlock schema is added to @rinner/grayvale-core
const statBlockSchema = z.record(z.string(), z.number());

import type { CombatStatGroupView, CombatStatRowView } from "./combat-stats.types";
import { CombatStatsViewComponent } from "./combat-stats-view.component";

interface StatConfig {
  key: string;
  label: string;
  section: string;
  isPercent: boolean;
}

const STAT_CONFIG: readonly StatConfig[] = [
  { key: "strength", label: "Strength", section: "primary", isPercent: false },
  { key: "mentality", label: "Mentality", section: "primary", isPercent: false },
  { key: "physical_damage", label: "Physical Damage", section: "combat", isPercent: false },
  { key: "dodge_chance", label: "Dodge", section: "combat", isPercent: true },
  { key: "block_chance", label: "Block", section: "combat", isPercent: true },
  { key: "armor", label: "Armor", section: "armor", isPercent: false },
  { key: "fire_resistance", label: "Fire Resistance", section: "armor", isPercent: true },
  { key: "max_hp", label: "HP", section: "resources", isPercent: false },
  { key: "mana", label: "Mana", section: "resources", isPercent: false }
] as const;

const SECTION_LABELS: Record<string, string> = {
  primary: "Primary Stats",
  combat: "Combat Stats",
  armor: "Armor & Resistance",
  resources: "Resources"
};

const formatValue = (value: number, isPercent: boolean): string => {
  if (isPercent) {
    return `${Math.round(value * 100)}%`;
  }
  return `${Math.round(value)}`;
};

const formatDelta = (delta: number, isPercent: boolean): string | null => {
  if (delta === 0) return null;
  const formatted = isPercent
    ? `${Math.abs(Math.round(delta * 100))}%`
    : `${Math.abs(Math.round(delta))}`;
  return delta > 0 ? `+${formatted}` : `-${formatted}`;
};

const buildLabeledModifiers = (
  loadout: Loadout,
  registry: Map<string, InventoryEquipmentItem>
): LabeledModifier[] => {
  const modifiers: LabeledModifier[] = [];
  const equippedIds = Object.values(loadout.slots).filter(
    (id): id is string => typeof id === "string"
  );

  for (const itemId of equippedIds) {
    const item = registry.get(itemId);
    if (!item?.combatStats) continue;

    const isSpecial = !!item.specialRarity;

    for (const cs of item.combatStats) {
      modifiers.push({
        stat: cs.stat,
        type: cs.operation,
        value: cs.value,
        source: item.name,
        category: "equipment",
        active: true,
        ...(isSpecial ? { special: true } : {})
      });
    }
  }

  return modifiers;
};

const buildStatGroups = (
  baseStats: StatBlock,
  modifiers: LabeledModifier[]
): CombatStatGroupView[] => {
  const breakdowns = computeStatBreakdowns(baseStats, modifiers);

  const sectionMap = new Map<string, CombatStatRowView[]>();

  for (const config of STAT_CONFIG) {
    const breakdown: StatBreakdown = breakdowns[config.key] ?? {
      stat: config.key,
      base: 0,
      modifiers: [],
      final: 0,
      displayState: "neutral"
    };

    const delta = breakdown.final - breakdown.base;
    const row: CombatStatRowView = {
      key: config.key,
      label: config.label,
      breakdown,
      formattedValue: formatValue(breakdown.final, config.isPercent),
      formattedDelta: formatDelta(delta, config.isPercent)
    };

    const rows = sectionMap.get(config.section) ?? [];
    rows.push(row);
    sectionMap.set(config.section, rows);
  }

  return Array.from(sectionMap.entries()).map(([sectionKey, stats]) => ({
    label: SECTION_LABELS[sectionKey] ?? sectionKey,
    stats
  }));
};

/**
 * Smart container for the combat stats panel.
 * Loads base stats and equipment items, computes labeled modifiers from the active
 * loadout, runs stat breakdowns via @rinner/grayvale-core, and passes view models
 * down to the dumb CombatStatsViewComponent.
 */
@Component({
  selector: "gv-combat-stats-container",
  standalone: true,
  imports: [CombatStatsViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <gv-combat-stats-view
      [statGroups]="statGroups()"
      [selectedKey]="selectedKey()"
      [selectedBreakdown]="selectedBreakdown()"
      [selectedLabel]="selectedLabel()"
      [isLoading]="isLoading()"
      [error]="error()"
      (statSelected)="onStatSelected($event)"
      (drawerClosed)="onDrawerClosed()"
    />
  `
})
export class CombatStatsContainerComponent {
  private readonly http = inject(HttpClient);

  readonly activeLoadout = input<Loadout>(sampleLoadoutDefault);

  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly baseStats = signal<StatBlock>({});
  private readonly itemRegistry = signal<Map<string, InventoryEquipmentItem>>(new Map());

  protected readonly selectedKey = signal<string | null>(null);

  protected readonly modifiers = computed<LabeledModifier[]>(() =>
    buildLabeledModifiers(this.activeLoadout(), this.itemRegistry())
  );

  protected readonly statGroups = computed<readonly CombatStatGroupView[]>(() =>
    buildStatGroups(this.baseStats(), this.modifiers())
  );

  protected readonly selectedBreakdown = computed<StatBreakdown | null>(() => {
    const key = this.selectedKey();
    if (!key) return null;
    for (const group of this.statGroups()) {
      const row = group.stats.find((r) => r.key === key);
      if (row) return row.breakdown;
    }
    return null;
  });

  protected readonly selectedLabel = computed<string | null>(() => {
    const key = this.selectedKey();
    if (!key) return null;
    return STAT_CONFIG.find((c) => c.key === key)?.label ?? key;
  });

  constructor() {
    combineLatest([
      this.http.get<unknown>("assets/data/base-stats.json"),
      this.http.get<unknown>("assets/data/equipment-items.json")
    ])
      .pipe(
        map(([rawBase, rawItems]) => {
          const baseStats: StatBlock = statBlockSchema.parse(rawBase);

          const items = Array.isArray(rawItems)
            ? rawItems.map((entry: unknown) => inventoryEquipmentItemSchema.parse(entry))
            : [];

          const registry = new Map<string, InventoryEquipmentItem>();
          for (const item of items) {
            registry.set(item.id, item);
          }

          return { baseStats, registry };
        }),
        catchError((err: unknown) => {
          const message = err instanceof Error ? err.message : "Failed to load combat stats.";
          this.error.set(message);
          this.isLoading.set(false);
          return of(null);
        }),
        takeUntilDestroyed()
      )
      .subscribe((result) => {
        if (result) {
          this.baseStats.set(result.baseStats);
          this.itemRegistry.set(result.registry);
        }
        this.isLoading.set(false);
      });
  }

  protected onStatSelected(key: string): void {
    this.selectedKey.update((prev) => (prev === key ? null : key));
  }

  protected onDrawerClosed(): void {
    this.selectedKey.set(null);
  }
}
