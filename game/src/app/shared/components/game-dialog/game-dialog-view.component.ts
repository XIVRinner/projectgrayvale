import {
  AfterViewChecked,
  Component,
  ElementRef,
  HostListener,
  input,
  output,
  viewChild
} from "@angular/core";

import {
  GameDialogChoiceView,
  GameDialogTranscriptEntry
} from "./game-dialog.types";

export type SpeakerRole = "npc" | "player" | "narrator";

@Component({
  selector: "gv-game-dialog-view",
  standalone: true,
  templateUrl: "./game-dialog-view.component.html",
  styleUrl: "./game-dialog-view.component.scss"
})
export class GameDialogViewComponent implements AfterViewChecked {
  readonly transcript = input.required<readonly GameDialogTranscriptEntry[]>();
  readonly currentEntry = input.required<GameDialogTranscriptEntry | null>();
  readonly choices = input.required<readonly GameDialogChoiceView[]>();
  readonly canAdvance = input.required<boolean>();
  readonly sceneImagePath = input<string | null>(null);
  protected readonly chatViewport = viewChild<ElementRef<HTMLDivElement>>("chatViewport");

  readonly advanceRequested = output<void>();
  readonly choiceSelected = output<number>();

  private lastRenderedEntryId: string | null = null;

  ngAfterViewChecked(): void {
    const lastEntryId = this.transcript().at(-1)?.id ?? null;

    if (!lastEntryId || lastEntryId === this.lastRenderedEntryId) {
      return;
    }

    this.lastRenderedEntryId = lastEntryId;

    const viewport = this.chatViewport()?.nativeElement;

    if (!viewport) {
      return;
    }

    queueMicrotask(() => {
      viewport.scrollTop = viewport.scrollHeight;
    });
  }

  @HostListener("document:keydown", ["$event"])
  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.canAdvance() || this.choices().length > 0) {
      return;
    }

    const key = event.key;
    const isAdvanceKey = key === "Enter" || key === " " || key === "Spacebar";

    if (!isAdvanceKey || isTypingTarget(event.target)) {
      return;
    }

    event.preventDefault();
    this.advanceRequested.emit();
  }

  protected speakerRole(entry: GameDialogTranscriptEntry): SpeakerRole {
    if (entry.kind === "narration") return "narrator";
    if (entry.actor?.id === "player") return "player";
    const id = entry.actor?.id?.toLowerCase() ?? "";
    const name = entry.actor?.name?.toLowerCase() ?? "";
    if (id === "narrator" || name === "narrator") return "narrator";
    return "npc";
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}
