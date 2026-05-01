import { Component, signal } from "@angular/core";

import { HomeViewComponent } from "./home-view.component";
import { HomeSection } from "./home.types";

@Component({
  selector: "gv-home-container",
  imports: [HomeViewComponent],
  template: `
    <gv-home-view
      [heading]="heading()"
      [summary]="summary()"
      [sections]="sections()"
    />
  `
})
export class HomeContainerComponent {
  readonly heading = signal("Baseline Layout");
  readonly summary = signal(
    "This baseline keeps visual components dumb, stores behavior in containers, and reserves data wiring for dedicated loaders/effects."
  );

  readonly sections = signal<readonly HomeSection[]>([
    {
      title: "Core",
      location: "src/app/core",
      responsibility: "Application-level services, guards, and root store setup.",
      notes: "Only singleton and cross-feature concerns belong here."
    },
    {
      title: "Data",
      location: "src/app/data",
      responsibility: "Load static JSON and dialogue files with schema validation.",
      notes: "Runtime content is read-only and loaded through HttpClient boundaries."
    },
    {
      title: "Features",
      location: "src/app/features",
      responsibility: "Each screen owns route, container, view, and local store slice.",
      notes: "Features communicate through actions and selectors, not direct imports."
    },
    {
      title: "Shared",
      location: "src/app/shared",
      responsibility: "Pure presentational components, directives, pipes, and theme tokens.",
      notes: "Design tokens in shared/theme are the single visual source of truth."
    }
  ]);
}
