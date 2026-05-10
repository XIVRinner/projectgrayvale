import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import type { DamageType, InventoryEquipmentItem } from "@rinner/grayvale-core";

// GAP: skill association
// Blocked on: design
// Needs: skillId association data on InventoryEquipmentItem
// Do not implement until: skill association field is defined on the item model

// GAP: rotation impact
// Blocked on: design
// Needs: rotation impact data on InventoryEquipmentItem
// Do not implement until: rotation impact field is defined on the item model

// GAP: power window
// Blocked on: design
// Needs: power window data on InventoryEquipmentItem
// Do not implement until: power window field is defined on the item model

// GAP: training impact
// Blocked on: design
// Needs: training impact data on InventoryEquipmentItem
// Do not implement until: training impact field is defined on the item model

// GAP: special effect display names
// Blocked on: @rinner/grayvale-core
// Needs: a registry mapping EffectId to display name
// Do not implement until: effect display names are accessible at runtime

@Component({
  selector: "gv-equipment-tooltip-body",
  standalone: true,
  templateUrl: "./equipment-tooltip-body.component.html",
  styleUrl: "./equipment-tooltip-body.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EquipmentTooltipBodyComponent {
  readonly item = input.required<InventoryEquipmentItem>();

  private static readonly DAMAGE_TYPE_ORDER: readonly DamageType[] = [
    "piercing",
    "slashing",
    "thrusting",
    "blunt",
    "nature"
  ];

  protected readonly slotLabel = computed(() =>
    this.item().slot.replace(/_/g, " ")
  );

  protected readonly levelRequirement = computed(
    () => this.item().requirements?.levelRequirement ?? null
  );

  protected readonly skillRequirement = computed(
    () => this.item().requirements?.skillRequirement ?? null
  );

  protected readonly hasCombatStats = computed(
    () => (this.item().combatStats?.length ?? 0) > 0
  );

  protected readonly damageEntries = computed(() =>
    EquipmentTooltipBodyComponent.DAMAGE_TYPE_ORDER.flatMap((damageType) => {
      const interval = this.item().damage?.[damageType];

      if (!interval) {
        return [];
      }

      return [
        {
          type: damageType,
          label: `${toTitleCase(damageType)} Damage`,
          value: `${interval.min}-${interval.max}`
        }
      ];
    })
  );

  protected readonly hasDamageProfile = computed(
    () => this.damageEntries().length > 0
  );

  protected readonly hasSpecialEffects = computed(
    () => (this.item().specialEffects?.length ?? 0) > 0
  );

  protected readonly hasTags = computed(() => this.item().tags.length > 0);

  protected readonly statLabel = (value: number, operation: "add" | "multiply"): string => {
    if (operation === "multiply") {
      const pct = Math.round((value - 1) * 100);
      return pct >= 0 ? `+${pct}%` : `${pct}%`;
    }
    return value >= 0 ? `+${value}` : `${value}`;
  };
}

function toTitleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
