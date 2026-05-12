import { Component, input } from "@angular/core";

import type { ChangelogEntryType, ChangelogRelease } from "../../../features/changelog/changelog.types";

type ChangelogMajorCategory =
  | "character"
  | "story"
  | "combat"
  | "quest"
  | "server"
  | "developer"
  | "meta";

@Component({
  selector: "gv-changelog-release-card",
  standalone: true,
  templateUrl: "./changelog-release-card.component.html",
  styleUrl: "./changelog-release-card.component.scss",
})
export class ChangelogReleaseCardComponent {
  readonly release = input.required<ChangelogRelease>();
  readonly compact = input(false);
  readonly showHeader = input(true);

  protected formatReleaseDate(value?: string): string {
    if (!value) {
      return "Draft";
    }

    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  protected typeLabel(type: ChangelogEntryType): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  protected primaryCategory(tags: readonly string[]): ChangelogMajorCategory {
    for (const tag of tags) {
      const normalized = tag.toLowerCase();

      if (
        [
          "character",
          "creator",
          "character-sheet",
          "inventory",
          "equipment",
          "stats",
          "save",
          "roster",
          "local",
        ].includes(normalized)
      ) {
        return "character";
      }

      if (
        ["dialogue", "story", "choices", "world", "shell", "ui", "actions"].includes(
          normalized,
        )
      ) {
        return "story";
      }

      if (["combat", "encounter"].includes(normalized)) {
        return "combat";
      }

      if (["quests", "quest", "tracker", "journal"].includes(normalized)) {
        return "quest";
      }

      if (
        ["server", "chat", "multiplayer", "session", "admin", "moderation"].includes(
          normalized,
        )
      ) {
        return "server";
      }

      if (["developer", "debug", "logs", "geg"].includes(normalized)) {
        return "developer";
      }

      if (["changelog", "release-notes"].includes(normalized)) {
        return "meta";
      }
    }

    return "meta";
  }

  protected categoryLabel(tags: readonly string[]): string {
    const category = this.primaryCategory(tags);

    switch (category) {
      case "character":
        return "Character";
      case "story":
        return "World";
      case "combat":
        return "Combat";
      case "quest":
        return "Quests";
      case "server":
        return "Server";
      case "developer":
        return "Debug";
      default:
        return "System";
    }
  }
}
