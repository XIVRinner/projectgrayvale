import { Component, input, output } from "@angular/core";

import { CharacterCreatorContainerComponent } from "../../../features/character-creator/character-creator-container.component";
import { DialogShellComponent } from "../../../shared/components/dialog-shell/dialog-shell.component";

@Component({
  selector: "gv-shell-character-creation-dialog",
  standalone: true,
  imports: [DialogShellComponent, CharacterCreatorContainerComponent],
  templateUrl: "./shell-character-creation-dialog.component.html",
  styleUrl: "./shell-character-creation-dialog.component.scss"
})
export class ShellCharacterCreationDialogComponent {
  readonly open = input.required<boolean>();
  readonly required = input(false);

  readonly closed = output<void>();
  readonly characterCreated = output<void>();
}
