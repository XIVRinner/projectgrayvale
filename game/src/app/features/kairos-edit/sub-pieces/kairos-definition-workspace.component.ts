import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import type { KairosDefinitionWorkspaceView } from "../kairos-edit.types";

@Component({
  selector: "gv-kairos-definition-workspace",
  standalone: true,
  templateUrl: "./kairos-definition-workspace.component.html",
  styleUrl: "./kairos-definition-workspace.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KairosDefinitionWorkspaceComponent {
  readonly view = input.required<KairosDefinitionWorkspaceView>();
  readonly ids = input.required<readonly string[]>();
  readonly selectedId = input<string | null>(null);
  readonly loading = input(false);
  readonly saving = input(false);
  readonly statusMessage = input<string | null>(null);
  readonly validationErrors = input<readonly string[]>([]);
  readonly validationWarnings = input<readonly string[]>([]);
  readonly hasDefinition = input(false);
  readonly saveDisabled = input(false);

  readonly definitionSelected = output<string>();
  readonly createRequested = output<void>();
  readonly reloadRequested = output<void>();
  readonly saveRequested = output<void>();
}
