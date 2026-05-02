import { Component, input, output, signal } from "@angular/core";

import { ShellSaveSlotSummary } from "../shell.types";

@Component({
  selector: "gv-shell-save-slot-card",
  standalone: true,
  templateUrl: "./shell-save-slot-card.component.html",
  styleUrl: "./shell-save-slot-card.component.scss"
})
export class ShellSaveSlotCardComponent {
  readonly slot = input.required<ShellSaveSlotSummary>();
  readonly selected = input.required<boolean>();

  readonly selectedRequested = output<string>();
  readonly loadRequested = output<string>();
  readonly exportRequested = output<string>();
  readonly deleteRequested = output<ShellSaveSlotSummary>();
  protected readonly prettyLabel = prettyLabel;
  protected readonly portraitFailed = signal(false);
  protected readonly fallbackPortraitSrc = "assets/images/no-texture.svg";
  protected isTagObject = (tag: unknown): tag is { label: string; type: string } => typeof tag === 'object';

  protected onSelected(): void {
    this.selectedRequested.emit(this.slot().id);
  }

  protected onLoad(event: Event): void {
    event.stopPropagation();
    this.loadRequested.emit(this.slot().id);
  }

  protected onExport(event: Event): void {
    event.stopPropagation();
    this.exportRequested.emit(this.slot().id);
  }

  protected onDelete(event: Event): void {
    event.stopPropagation();
    this.deleteRequested.emit(this.slot());
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

    if (slot.expertMode || slot.ironmanMode) {
      const flags = [
        slot.expertMode ? "Expert" : null,
        slot.ironmanMode ? "Ironman" : null
      ].filter((value): value is string => value !== null);

      return `${base} | ${flags.join(" | ")}`;
    }

    return base;
  }

  protected tags(slot: ShellSaveSlotSummary): readonly (string | { label: string; type: string; difficulty?: string })[] {
    const tags: (string | { label: string; type: string; difficulty?: string })[] = [
      { label: prettyLabel(slot.raceId), type: 'race' },
      { label: prettyLabel(slot.classId), type: 'class' },
      { label: `Level ${slot.level}`, type: 'level' },
      { label: this.formattedMode(slot), type: 'mode', difficulty: slot.difficultyMode.toLowerCase() }
    ];

    for (const talent of slot.talents.slice(0, 2)) {
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
