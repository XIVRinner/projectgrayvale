import { ChangeDetectionStrategy, Component, input, output, signal } from "@angular/core";
import { ButtonModule } from "primeng/button";
import { DialogModule } from "primeng/dialog";
import { TabsModule } from "primeng/tabs";

interface KairosEditTabView {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly wip: boolean;
}

const KAIROS_EDIT_TABS: readonly KairosEditTabView[] = [
  { id: "items", label: "Items", description: "Item editor shell ready. Definition editing UI comes next.", wip: false },
  { id: "materials", label: "Materials", description: "Material editor shell ready. Definition editing UI comes next.", wip: false },
  { id: "locations", label: "Locations", description: "Location and sublocation editor shell ready. Definition editing UI comes next.", wip: false },
  { id: "activities", label: "Activities", description: "Activity editor shell ready. Definition editing UI comes next.", wip: false },
  { id: "actions", label: "Actions", description: "Action editor shell ready. Definition editing UI comes next.", wip: false },
  { id: "tags", label: "Tags — WIP", description: "Tag registry editing is intentionally out of scope for this milestone.", wip: true }
] as const;

@Component({
  selector: "gv-shell-kairos-edit-dialog",
  standalone: true,
  imports: [ButtonModule, DialogModule, TabsModule],
  templateUrl: "./shell-kairos-edit-dialog.component.html",
  styleUrl: "./shell-kairos-edit-dialog.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShellKairosEditDialogComponent {
  readonly open = input.required<boolean>();

  readonly closed = output<void>();

  protected readonly tabs = KAIROS_EDIT_TABS;
  protected readonly activeTab = signal(KAIROS_EDIT_TABS[0]?.id ?? "items");

  protected setActiveTab(value: string | number | undefined): void {
    if (typeof value === "string") {
      this.activeTab.set(value);
    }
  }

  protected closeDialog(): void {
    this.closed.emit();
  }
}
