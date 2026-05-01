import { Component, computed, input } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";

import { ShellFooterComponent } from "./shell-footer.component";
import {
  ShellActivityItem,
  ShellLayoutPreset,
  ShellNavItem,
  ShellStatusItem
} from "./shell.types";

@Component({
  selector: "gv-shell-view",
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ShellFooterComponent],
  templateUrl: "./shell-view.component.html",
  styleUrl: "./shell-view.component.scss"
})
export class ShellViewComponent {
  readonly title = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly navItems = input.required<readonly ShellNavItem[]>();
  readonly layoutPreset = input.required<ShellLayoutPreset>();
  readonly statusItems = input.required<readonly ShellStatusItem[]>();
  readonly activityItems = input.required<readonly ShellActivityItem[]>();
  readonly version = input.required<string>();

  protected readonly isCommandCenter = computed(
    () => this.layoutPreset() === "command-center"
  );
}
