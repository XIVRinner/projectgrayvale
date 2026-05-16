import { Component, input, output } from "@angular/core";

import type { CharacterCompatibilityStatus } from "./player-profile-api.service";

@Component({
  selector: "gv-player-character-card",
  standalone: true,
  template: `
    <div
      class="gv-char-card"
      [class.gv-char-card--incompatible]="!status().compatible"
      [class.gv-char-card--selected]="selected()"
      [attr.aria-disabled]="!status().compatible"
    >
      <div class="gv-char-card__portrait-wrap">
        @if (portraitSrc()) {
          <img
            class="gv-char-card__portrait"
            [src]="portraitSrc()!"
            [alt]="status().character.name + ' portrait'"
          />
        } @else {
          <span class="gv-char-card__portrait-fallback">{{ portraitFallbackText() }}</span>
        }
      </div>
      <div class="gv-char-card__body">
        <p class="gv-char-card__name">{{ status().character.name }}</p>
        @if (selected()) {
          <p class="gv-char-card__server">Active on this server</p>
        }
        <p class="gv-char-card__server">Level: {{ levelLabel() }}</p>
        <p class="gv-char-card__server">Last Location: {{ locationLabel() }}</p>
        <p class="gv-char-card__server">
          @if (status().character.contentBinding; as binding) {
            {{ binding.serverName }} &middot;
            <span class="gv-char-card__content-tag"
              [class.gv-char-card__content-tag--custom]="binding.customContent">
              {{ binding.customContent ? 'Custom' : 'Official' }}
            </span>
          } @else {
            <span class="gv-char-card__content-tag">Unbound</span>
          }
        </p>
        @if (!status().compatible) {
          <p class="gv-char-card__incompatible-reason">{{ status().reason }}</p>
        }
      </div>
      <button
        type="button"
        class="gv-char-card__remove-btn"
        [disabled]="selected()"
        (click)="removeRequested.emit(status().character.id)"
        [attr.title]="selected() ? 'Switch to a different character before removing this one from the server profile.' : 'Remove from this server profile'"
      >
        Remove
      </button>
    </div>
  `,
  styleUrl: "./player-character-card.component.scss",
})
export class PlayerCharacterCardComponent {
  readonly status = input.required<CharacterCompatibilityStatus>();
  readonly portraitSrc = input<string | null>(null);
  readonly selected = input(false);
  readonly removeRequested = output<string>();

  protected levelLabel(): string {
    const level = this.status().character.level;
    return typeof level === "number" ? String(level) : "Unknown";
  }

  protected locationLabel(): string {
    return this.status().character.lastLocationName ?? "Unknown";
  }

  protected portraitFallbackText(): string {
    const name = this.status().character.name.trim();
    return name.length > 0 ? name[0]!.toUpperCase() : "?";
  }
}
