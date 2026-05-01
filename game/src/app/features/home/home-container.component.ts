import { Component, computed, inject } from "@angular/core";

import { CharacterRosterService } from "../../core/services/character-roster.service";
import { HomeViewComponent } from "./home-view.component";
import { HomeAdventurerSummary, HomeQuickLink } from "./home.types";

@Component({
  selector: "gv-home-container",
  imports: [HomeViewComponent],
  template: `
    <gv-home-view
      [adventurer]="adventurer()"
      [quickLinks]="quickLinks"
    />
  `
})
export class HomeContainerComponent {
  private readonly roster = inject(CharacterRosterService);

  readonly adventurer = computed<HomeAdventurerSummary | null>(() => {
    const active = this.roster.activeCharacter();
    if (!active) {
      return null;
    }

    const level = active.progression.level;
    const rank = level >= 50 ? "S" : level >= 30 ? "A" : level >= 15 ? "B" : level >= 5 ? "C" : "G";

    return {
      name: active.name,
      raceId: active.raceId,
      classId: active.jobClass,
      level,
      rank,
      lastSaved: this.roster.activeSlot()?.updatedAt
        ? new Date(this.roster.activeSlot()!.updatedAt).toLocaleDateString()
        : "—"
    };
  });

  readonly quickLinks: readonly HomeQuickLink[] = [
    {
      label: "Activities",
      description: "Take on work, gather resources, and build your reputation.",
      icon: "pi pi-bolt",
      route: "/activity",
      disabled: true
    },
    {
      label: "Companions",
      description: "Manage relationships and party composition.",
      icon: "pi pi-users",
      route: "/companion",
      disabled: true
    },
    {
      label: "Inventory",
      description: "Review equipment, consumables, and loot.",
      icon: "pi pi-box",
      route: "/inventory",
      disabled: true
    },
    {
      label: "Quests",
      description: "Track active contracts and story chapters.",
      icon: "pi pi-map",
      route: "/quest",
      disabled: true
    },
    {
      label: "Combat",
      description: "Enter the arena or respond to an encounter.",
      icon: "pi pi-shield",
      route: "/combat",
      disabled: true
    },
    {
      label: "Creator Lab",
      description: "Register a new adventurer.",
      icon: "pi pi-user-plus",
      route: "/creator",
      disabled: false
    }
  ];
}
