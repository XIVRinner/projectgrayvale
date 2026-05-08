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
import { catchError, map, of } from "rxjs";

import {
  computeStatBreakdowns,
  inventoryEquipmentItemSchema,
  sampleLoadoutDefault,
  type BalanceProfile,
  type InventoryEquipmentItem,
  type LabeledModifier,
  type Loadout,
  type Player,
  type StatBlock,
  type StatBreakdown
} from "@rinner/grayvale-core";

import { parseItemArrayWithIconPath } from "../character-sheet-item-assets";
import type { CharacterStatUnlockState } from "../../../core/services/character-roster.service";
import { GameSettingsService } from "../../../core/services/game-settings.service";
import {
  PLAYER_HEALTH_BALANCE_PROFILE_ID,
  type SaveSlotHealthState
} from "../../../core/services/health-balance";
import type { CombatStatGroupView, CombatStatRowView } from "./combat-stats.types";
import { CombatStatsViewComponent } from "./combat-stats-view.component";

interface StatConfig {
  key: string;
  label: string;
  section: string;
  isPercent: boolean;
  unlockKind?: "attribute";
}

const STAT_CONFIG: readonly StatConfig[] = [
  { key: "vitality", label: "Vitality", section: "primary", isPercent: false, unlockKind: "attribute" },
  { key: "strength", label: "Strength", section: "primary", isPercent: false, unlockKind: "attribute" },
  { key: "agility", label: "Agility", section: "primary", isPercent: false, unlockKind: "attribute" },
  { key: "mentality", label: "Mentality", section: "primary", isPercent: false, unlockKind: "attribute" },
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
  modifiers: LabeledModifier[],
  statUnlocks: CharacterStatUnlockState | null
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
      isLocked: isStatLocked(config, statUnlocks),
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

const buildBaseStats = (
  player: Player | null,
  health: SaveSlotHealthState | null,
  balanceProfile: BalanceProfile | undefined
): StatBlock => {
  if (!player) {
    return {};
  }

  const vitality = player.attributes["vitality"] ?? 0;
  const vitalityScalar = balanceProfile?.scalars?.attributes?.["vitality"] ?? 1;
  const maxHpFlat = balanceProfile?.scalars?.resources?.["maxHpFlat"] ?? 0;
  const maxHp = health?.maxHp ?? Math.max(0, Math.round(maxHpFlat + vitality * vitalityScalar));

  return {
    ...player.attributes,
    physical_damage: 0,
    dodge_chance: 0,
    block_chance: 0,
    armor: 0,
    fire_resistance: 0,
    max_hp: maxHp,
    mana: 0
  };
};

const isStatLocked = (
  config: StatConfig,
  statUnlocks: CharacterStatUnlockState | null
): boolean => {
  if (config.unlockKind !== "attribute") {
    return false;
  }

  const unlocked = statUnlocks?.attributes[config.key];

  if (typeof unlocked === "boolean") {
    return !unlocked;
  }

  return config.key !== "vitality";
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
  private readonly gameSettings = inject(GameSettingsService);

  readonly activeLoadout = input<Loadout>(sampleLoadoutDefault);
  readonly player = input<Player | null>(null);
  readonly health = input<SaveSlotHealthState | null>(null);
  readonly statUnlocks = input<CharacterStatUnlockState | null>(null);

  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly itemRegistry = signal<Map<string, InventoryEquipmentItem>>(new Map());

  protected readonly selectedKey = signal<string | null>(null);
  private readonly healthProfile = computed(
    () => this.gameSettings.balanceProfileFor(PLAYER_HEALTH_BALANCE_PROFILE_ID) ?? undefined
  );
  private readonly baseStats = computed<StatBlock>(() =>
    buildBaseStats(this.player(), this.health(), this.healthProfile())
  );

  protected readonly modifiers = computed<LabeledModifier[]>(() =>
    buildLabeledModifiers(this.activeLoadout(), this.itemRegistry())
  );

  protected readonly statGroups = computed<readonly CombatStatGroupView[]>(() =>
    buildStatGroups(this.baseStats(), this.modifiers(), this.statUnlocks())
  );

  protected readonly selectedBreakdown = computed<StatBreakdown | null>(() => {
    const key = this.selectedKey();
    if (!key) return null;
    for (const group of this.statGroups()) {
      const row = group.stats.find((r) => r.key === key);
      if (row && !row.isLocked) return row.breakdown;
    }
    return null;
  });

  protected readonly selectedLabel = computed<string | null>(() => {
    const key = this.selectedKey();
    if (!key) return null;
    const row = this.statGroups()
      .flatMap((group) => group.stats)
      .find((candidate) => candidate.key === key);

    if (row?.isLocked) {
      return null;
    }

    return STAT_CONFIG.find((c) => c.key === key)?.label ?? key;
  });

  constructor() {
    this.http
      .get<unknown>("assets/data/equipment-items.json")
      .pipe(
        map((rawItems) => {
          const items = parseItemArrayWithIconPath(rawItems, (entry) => inventoryEquipmentItemSchema.parse(entry));

          const registry = new Map<string, InventoryEquipmentItem>();
          for (const item of items) {
            registry.set(item.id, item);
          }

          return registry;
        }),
        catchError((err: unknown) => {
          const message = err instanceof Error ? err.message : "Failed to load combat stats.";
          this.error.set(message);
          this.isLoading.set(false);
          return of(null);
        }),
        takeUntilDestroyed()
      )
      .subscribe((registry) => {
        if (registry) {
          this.itemRegistry.set(registry);
        }
        this.isLoading.set(false);
      });
  }

  protected onStatSelected(key: string): void {
    const row = this.statGroups()
      .flatMap((group) => group.stats)
      .find((candidate) => candidate.key === key);

    if (row?.isLocked) {
      this.selectedKey.set(null);
      return;
    }

    this.selectedKey.update((prev) => (prev === key ? null : key));
  }

  protected onDrawerClosed(): void {
    this.selectedKey.set(null);
  }
}
