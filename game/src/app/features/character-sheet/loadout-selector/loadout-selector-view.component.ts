import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import type { EquipmentSlot } from "@rinner/grayvale-core";

import type {
  LoadoutEquipEvent,
  LoadoutRenameEvent,
  LoadoutRowView,
  LoadoutSlotEquipOptionView,
  LoadoutSlotRowView
} from "./loadout-selector.types";
import { LoadoutItemComponent } from "./sub-pieces/loadout-item.component";
import { LoadoutSlotCardComponent } from "./sub-pieces/loadout-slot-card.component";

@Component({
  selector: "gv-loadout-selector-view",
  standalone: true,
  imports: [LoadoutItemComponent, LoadoutSlotCardComponent],
  templateUrl: "./loadout-selector-view.component.html",
  styleUrl: "./loadout-selector-view.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadoutSelectorViewComponent {
  readonly loadouts = input.required<readonly LoadoutRowView[]>();
  readonly activeSlots = input.required<readonly LoadoutSlotRowView[]>();
  readonly itemsBySlot = input.required<Readonly<Record<EquipmentSlot, readonly LoadoutSlotEquipOptionView[]>>>();
  readonly isLoading = input.required<boolean>();
  readonly error = input.required<string | null>();

  readonly loadoutSelected = output<string>();
  readonly loadoutCreated = output<void>();
  readonly loadoutRenamed = output<LoadoutRenameEvent>();
  readonly itemEquipped = output<LoadoutEquipEvent>();
  readonly itemUnequipped = output<EquipmentSlot>();
}
