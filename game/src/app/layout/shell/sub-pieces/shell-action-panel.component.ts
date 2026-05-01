import { Component, input, output } from "@angular/core";

import { ShellActionGroup } from "../shell.types";

@Component({
  selector: "gv-shell-action-panel",
  standalone: true,
  templateUrl: "./shell-action-panel.component.html",
  styleUrl: "./shell-action-panel.component.scss"
})
export class ShellActionPanelComponent {
  readonly groups = input.required<readonly ShellActionGroup[]>();
  readonly actionSelected = output<string>();
}
