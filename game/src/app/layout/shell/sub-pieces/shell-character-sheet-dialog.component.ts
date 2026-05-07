import { Component, input, output } from "@angular/core";

import { CharacterSheetContainerComponent } from "../../../features/character-sheet/character-sheet-container.component";
import { DialogShellComponent } from "../../../shared/components/dialog-shell/dialog-shell.component";
import { ShellCharacterPanel } from "../shell.types";

@Component({
  selector: "gv-shell-character-sheet-dialog",
  standalone: true,
  imports: [CharacterSheetContainerComponent, DialogShellComponent],
  templateUrl: "./shell-character-sheet-dialog.component.html",
  styleUrl: "./shell-character-sheet-dialog.component.scss"
})
export class ShellCharacterSheetDialogComponent {
  readonly open = input.required<boolean>();
  readonly panel = input.required<ShellCharacterPanel>();

  readonly closed = output<void>();
}
