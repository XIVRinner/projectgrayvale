import { Component, input, output, signal } from "@angular/core";

import { ShellSaveSlotSummary } from "../shell.types";

@Component({
  selector: "gv-shell-save-slot-detail",
  standalone: true,
  templateUrl: "./shell-save-slot-detail.component.html",
  styleUrl: "./shell-save-slot-detail.component.scss"
})
export class ShellSaveSlotDetailComponent {
  readonly slot = input<ShellSaveSlotSummary | null>(null);

  readonly loadRequested = output<string>();
  protected readonly portraitFailed = signal(false);
  protected readonly fallbackPortraitSrc = "assets/images/no-texture.svg";
  protected isTagObject = (tag: unknown): tag is { label: string; type: string } => typeof tag === 'object';

  protected initials(name: string): string {
    const parts = name
      .trim()
      .split(/\s+/)
      .filter((value) => value.length > 0)
      .slice(0, 2);

    if (parts.length === 0) {
      return "NA";
    }

    return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  }

  protected onLoad(slot: ShellSaveSlotSummary): void {
    this.loadRequested.emit(slot.id);
  }

  protected onPortraitError(event: Event): void {
    const image = event.target as HTMLImageElement;

    if (image.src.endsWith(this.fallbackPortraitSrc)) {
      return;
    }

    this.portraitFailed.set(true);
    image.src = this.fallbackPortraitSrc;
  }

  protected portraitSrc(slot: ShellSaveSlotSummary): string {
    if (this.portraitFailed()) {
      return this.fallbackPortraitSrc;
    }

    return slot.portraitSrc ?? this.fallbackPortraitSrc;
  }

  protected formattedMode(slot: ShellSaveSlotSummary): string {
    const base = prettyLabel(slot.difficultyMode);
    const flags = [
      slot.expertMode ? "Expert" : null,
      slot.ironmanMode ? "Ironman" : null
    ].filter((value): value is string => value !== null);

    return flags.length > 0 ? `${base} | ${flags.join(" | ")}` : base;
  }

  protected readonly prettyLabel = prettyLabel;

  protected tags(slot: ShellSaveSlotSummary): readonly (string | { label: string; type: string; difficulty?: string })[] {
    const tags: (string | { label: string; type: string; difficulty?: string })[] = [
      { label: prettyLabel(slot.raceId), type: 'race' },
      { label: prettyLabel(slot.classId), type: 'class' },
      { label: `Level ${slot.level}`, type: 'level' },
      { label: this.formattedMode(slot), type: 'mode', difficulty: slot.difficultyMode.toLowerCase() }
    ];

    for (const talent of slot.talents.slice(0, 3)) {
      tags.push({ label: prettyLabel(talent), type: 'talent' });
    }

    return tags;
  }
}

function prettyLabel(value: string): string {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (segment) => segment.toUpperCase());
}
