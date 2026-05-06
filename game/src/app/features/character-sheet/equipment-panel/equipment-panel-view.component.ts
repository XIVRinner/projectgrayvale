import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import type { EquipmentSlot } from "@rinner/grayvale-core";

import type { EquipmentSlotView } from "./equipment-panel.types";
import { EquipmentSlotComponent } from "./sub-pieces/equipment-slot.component";

@Component({
  selector: "gv-equipment-panel-view",
  standalone: true,
  imports: [EquipmentSlotComponent],
  templateUrl: "./equipment-panel-view.component.html",
  styleUrl: "./equipment-panel-view.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EquipmentPanelViewComponent {
  readonly slots = input.required<readonly EquipmentSlotView[]>();
  readonly isLoading = input.required<boolean>();
  readonly error = input.required<string | null>();

  readonly tooltipRequested = output<EquipmentSlot>();
  readonly compareRequested = output<EquipmentSlot>();
}
