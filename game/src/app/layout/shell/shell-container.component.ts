import { Component, signal } from "@angular/core";

import { ShellViewComponent } from "./shell-view.component";
import {
  ShellActivityItem,
  ShellLayoutPreset,
  ShellNavItem,
  ShellStatusItem
} from "./shell.types";

@Component({
  selector: "gv-shell-container",
  imports: [ShellViewComponent],
  template: `
    <gv-shell-view
      [title]="title()"
      [subtitle]="subtitle()"
      [navItems]="navItems()"
      [layoutPreset]="layoutPreset()"
      [statusItems]="statusItems()"
      [activityItems]="activityItems()"
      [version]="version"
    />
  `
})
export class ShellContainerComponent {
  readonly version = "0.0.1";

  readonly title = signal("Project GrayVale");
  readonly subtitle = signal(
    "Command-center inspired shell salvaged from legacy layout patterns and adapted for Angular 21 standalone components."
  );

  readonly layoutPreset = signal<ShellLayoutPreset>("command-center");

  readonly navItems = signal<readonly ShellNavItem[]>([
    {
      label: "Home",
      route: "/",
      description: "High-level baseline structure and responsibilities."
    },
    {
      label: "Operations",
      route: "/",
      description: "Legacy command-center presentation for current feature routes."
    }
  ]);

  readonly statusItems = signal<readonly ShellStatusItem[]>([
    { label: "Layout", value: "Command Center" },
    { label: "Runtime", value: "Web" },
    { label: "Data Source", value: "Assets + Schemas" }
  ]);

  readonly activityItems = signal<readonly ShellActivityItem[]>([
    {
      title: "Theme Migration",
      detail: "Legacy night-gold palette mapped into shared tokens and PrimeNG preset."
    },
    {
      title: "Layout Salvage",
      detail: "Three-zone command-center structure adapted from oldgame layout behavior."
    },
    {
      title: "Architecture Guardrails",
      detail: "Container remains smart while shell view stays store-agnostic and presentational."
    }
  ]);
}
