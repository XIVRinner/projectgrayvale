import { Component, input, output } from "@angular/core";

import {
  ShellStatusItem,
  ShellTopbarAction,
  ShellTopbarSaveSummary
} from "../shell.types";

@Component({
  selector: "gv-shell-topbar",
  standalone: true,
  templateUrl: "./shell-topbar.component.html",
  styleUrl: "./shell-topbar.component.scss"
})
export class ShellTopbarComponent {
  readonly title = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly statusItems = input.required<readonly ShellStatusItem[]>();
  readonly saveSummary = input.required<ShellTopbarSaveSummary>();
  readonly actions = input.required<readonly ShellTopbarAction[]>();
  readonly saveManagerRequested = output<void>();
}