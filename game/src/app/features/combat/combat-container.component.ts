import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";

import { CombatEncounterService } from "./combat-encounter.service";
import { CombatViewComponent } from "./combat-view.component";

@Component({
  selector: "gv-combat-container",
  standalone: true,
  imports: [CombatViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <gv-combat-view
      [encounter]="encounter()"
      [previewRotation]="previewRotation()"
      (returnRequested)="onReturnRequested()"
      (dismissRequested)="onDismissRequested()"
    />
  `
})
export class CombatContainerComponent {
  private readonly combat = inject(CombatEncounterService);

  protected readonly encounter = computed(() => null);
  protected readonly previewRotation = computed(() => this.combat.previewRotation());

  protected onDismissRequested(): void {
    this.combat.closeSummary();
  }

  protected onReturnRequested(): void {
    this.combat.closeSummary();
  }
}
