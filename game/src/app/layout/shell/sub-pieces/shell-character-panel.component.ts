import { Component, input } from "@angular/core";

import { GapWarningComponent } from "../../../shared/components/gap-warning/gap-warning.component";
import { ImagePreviewComponent } from "../../../shared/components/image-preview/image-preview.component";
import { ProgressBarComponent } from "../../../shared/components/progress-bar/progress-bar.component";
import { StatAccordionComponent } from "../../../shared/components/stat-accordion/stat-accordion.component";
import { ShellCharacterPanel } from "../shell.types";

@Component({
  selector: "gv-shell-character-panel",
  standalone: true,
  imports: [GapWarningComponent, ImagePreviewComponent, ProgressBarComponent, StatAccordionComponent],
  templateUrl: "./shell-character-panel.component.html",
  styleUrl: "./shell-character-panel.component.scss"
})
export class ShellCharacterPanelComponent {
  readonly panel = input.required<ShellCharacterPanel>();
}
