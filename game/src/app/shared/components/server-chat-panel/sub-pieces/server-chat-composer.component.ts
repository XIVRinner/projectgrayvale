import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { Picker } from "emoji-mart";

import {
  type ServerChatCommandView,
  type ServerChatCustomEmojiView,
} from "../../../../core/services/server-chat.models";
import {
  EMOJI_MART_DATA,
  buildEmojiMartCustomCategories,
  replaceStandardEmojiShortcodes,
  searchStandardEmoji,
} from "../server-chat-emoji.utils";

type ComposerSuggestion =
  | {
      readonly kind: "command";
      readonly key: string;
      readonly title: string;
      readonly detail: string;
      readonly insertText: string;
      readonly preview: string;
    }
  | {
      readonly kind: "emoji";
      readonly key: string;
      readonly title: string;
      readonly detail: string;
      readonly insertText: string;
      readonly preview: string;
      readonly imageSrc?: string;
    };

interface SuggestionContext {
  readonly start: number;
  readonly end: number;
  readonly kind: "command" | "emoji";
}

@Component({
  selector: "gv-server-chat-composer",
  standalone: true,
  templateUrl: "./server-chat-composer.component.html",
  styleUrl: "./server-chat-composer.component.scss",
})
export class ServerChatComposerComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly canSend = input(false);
  readonly isSending = input(false);
  readonly commands = input<readonly ServerChatCommandView[]>([]);
  readonly customEmojis = input<readonly ServerChatCustomEmojiView[]>([]);
  readonly hint = input<string | null>(null);

  readonly sendRequested = output<string>();

  protected readonly draft = signal("");
  protected readonly pickerOpen = signal(false);
  protected readonly suggestions = signal<readonly ComposerSuggestion[]>([]);
  protected readonly activeSuggestionIndex = signal(0);

  protected readonly textarea =
    viewChild<ElementRef<HTMLTextAreaElement>>("textarea");
  protected readonly pickerHost =
    viewChild<ElementRef<HTMLDivElement>>("pickerHost");

  private readonly selectionStart = signal(0);
  private readonly selectionEnd = signal(0);
  private readonly suggestionContext = signal<SuggestionContext | null>(null);
  private suggestionRequestId = 0;

  protected readonly composerHint = computed(() =>
    this.hint() ??
    (this.canSend()
      ? "Enter sends. Shift+Enter makes a new line. Use : for emotes and / for relay commands."
      : "Connect this character before sending messages."),
  );

  constructor() {
    effect(() => {
      const host = this.pickerHost()?.nativeElement;
      const pickerOpen = this.pickerOpen();
      const customEmojis = this.customEmojis();

      if (!host) {
        return;
      }

      if (!pickerOpen) {
        host.replaceChildren();
        return;
      }

      const picker = new Picker({
        custom: buildEmojiMartCustomCategories(customEmojis),
        data: EMOJI_MART_DATA,
        emojiButtonRadius: "12px",
        emojiButtonSize: 34,
        emojiSize: 20,
        maxFrequentRows: 1,
        navPosition: "top",
        onClickOutside: () => this.pickerOpen.set(false),
        onEmojiSelect: (emoji: unknown) => this.handlePickerSelect(emoji),
        perLine: 8,
        previewPosition: "none",
        searchPosition: "sticky",
        set: "twitter",
        skinTonePosition: "none",
        theme: "dark",
      });

      host.replaceChildren(picker as unknown as Node);
    });

    const onPointerDown = (event: PointerEvent) => {
      if (!this.pickerOpen()) {
        return;
      }

      const target = event.target;
      const pickerHost = this.pickerHost()?.nativeElement;
      const textarea = this.textarea()?.nativeElement;

      if (target instanceof Node && pickerHost?.contains(target)) {
        return;
      }

      if (target instanceof Node && textarea?.contains(target)) {
        return;
      }

      this.pickerOpen.set(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    this.destroyRef.onDestroy(() =>
      document.removeEventListener("pointerdown", onPointerDown),
    );

    effect(() => {
      const draft = this.draft();
      const selectionStart = this.selectionStart();
      const commands = this.commands();
      const customEmojis = this.customEmojis();

      void this.refreshSuggestions(draft, selectionStart, commands, customEmojis);
    });
  }

  protected onDraftInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.draft.set(textarea.value);
    this.setSelection(textarea);
  }

  protected onDraftClick(event: Event): void {
    this.setSelection(event.target as HTMLTextAreaElement);
  }

  protected onDraftKeyup(event: Event): void {
    this.setSelection(event.target as HTMLTextAreaElement);
  }

  protected onDraftKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      this.suggestions.set([]);
      this.pickerOpen.set(false);
      return;
    }

    if (this.suggestions().length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        this.activeSuggestionIndex.update(
          (index) => (index + 1) % this.suggestions().length,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        this.activeSuggestionIndex.update(
          (index) =>
            (index - 1 + this.suggestions().length) % this.suggestions().length,
        );
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        this.applySuggestion(
          this.suggestions()[this.activeSuggestionIndex()] ?? null,
        );
        return;
      }
    }

    if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
      return;
    }

    event.preventDefault();

    if (this.shouldCommitSuggestion()) {
      this.applySuggestion(
        this.suggestions()[this.activeSuggestionIndex()] ?? null,
      );
      return;
    }

    this.send();
  }

  protected togglePicker(): void {
    this.pickerOpen.update((value) => !value);
  }

  protected chooseSuggestion(index: number): void {
    const suggestion = this.suggestions()[index] ?? null;

    if (!suggestion) {
      return;
    }

    this.activeSuggestionIndex.set(index);
    this.applySuggestion(suggestion);
  }

  protected send(): void {
    const message = replaceStandardEmojiShortcodes(
      this.draft().trim(),
      this.customEmojis(),
    );

    if (!message || this.isSending()) {
      return;
    }

    this.sendRequested.emit(message);
    this.draft.set("");
    this.selectionStart.set(0);
    this.selectionEnd.set(0);
    this.suggestions.set([]);
    this.suggestionContext.set(null);
  }

  protected trackBySuggestion(
    _index: number,
    suggestion: ComposerSuggestion,
  ): string {
    return suggestion.key;
  }

  private setSelection(textarea: HTMLTextAreaElement): void {
    this.selectionStart.set(textarea.selectionStart ?? textarea.value.length);
    this.selectionEnd.set(textarea.selectionEnd ?? textarea.value.length);
  }

  private shouldCommitSuggestion(): boolean {
    const context = this.suggestionContext();
    const suggestion = this.suggestions()[this.activeSuggestionIndex()] ?? null;

    return Boolean(
      context &&
        suggestion &&
        !(
          context.kind === "command" &&
          this.draft().trim().toLowerCase() === suggestion.insertText.toLowerCase()
        ),
    );
  }

  private async refreshSuggestions(
    draft: string,
    caret: number,
    commands: readonly ServerChatCommandView[],
    customEmojis: readonly ServerChatCustomEmojiView[],
  ): Promise<void> {
    const requestId = ++this.suggestionRequestId;
    const commandContext = findCommandContext(draft, caret);

    if (commandContext) {
      this.suggestionContext.set(commandContext);
      const query = draft
        .slice(commandContext.start + 1, commandContext.end)
        .toLowerCase();
      const suggestions = commands
        .filter((command) =>
          [command.trigger.slice(1), command.label, ...command.keywords]
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
        .map<ComposerSuggestion>((command) => ({
          kind: "command",
          key: command.id,
          title: command.label,
          detail: command.description,
          insertText: command.trigger,
          preview: command.trigger,
        }));

      if (requestId === this.suggestionRequestId) {
        this.suggestions.set(suggestions);
        this.activeSuggestionIndex.set(0);
      }
      return;
    }

    const emojiContext = findEmojiContext(draft, caret);

    if (!emojiContext) {
      if (requestId === this.suggestionRequestId) {
        this.suggestionContext.set(null);
        this.suggestions.set([]);
        this.activeSuggestionIndex.set(0);
      }
      return;
    }

    this.suggestionContext.set(emojiContext);
    const query = draft
      .slice(emojiContext.start + 1, emojiContext.end)
      .toLowerCase();
    const customSuggestions = customEmojis
      .filter((emoji) =>
        query.length === 0
          ? true
          : [emoji.id, emoji.name, ...emoji.keywords]
              .join(" ")
              .toLowerCase()
              .includes(query),
      )
      .slice(0, 5)
      .map<ComposerSuggestion>((emoji) => ({
        kind: "emoji",
        key: `custom:${emoji.id}`,
        title: emoji.name,
        detail: emoji.shortcode,
        insertText: emoji.shortcode,
        preview: emoji.shortcode,
        imageSrc: emoji.src,
      }));

    const standardSuggestions =
      query.length === 0
        ? []
        : (await searchStandardEmoji(query, 5)).map<ComposerSuggestion>(
            (emoji) => ({
              kind: "emoji",
              key: `standard:${emoji.id}`,
              title: emoji.name,
              detail: emoji.shortcode,
              insertText: emoji.native,
              preview: emoji.native,
            }),
          );

    if (requestId !== this.suggestionRequestId) {
      return;
    }

    this.suggestions.set(
      [...customSuggestions, ...standardSuggestions].slice(0, 8),
    );
    this.activeSuggestionIndex.set(0);
  }

  private applySuggestion(suggestion: ComposerSuggestion | null): void {
    const context = this.suggestionContext();
    const textarea = this.textarea()?.nativeElement;

    if (!suggestion || !context || !textarea) {
      return;
    }

    const prefix = this.draft().slice(0, context.start);
    const suffix = this.draft().slice(context.end);
    const insertion = `${suggestion.insertText} `;
    const nextValue = `${prefix}${insertion}${suffix}`;
    const caret = prefix.length + insertion.length;

    this.draft.set(nextValue);
    this.suggestions.set([]);
    this.suggestionContext.set(null);
    this.pickerOpen.set(false);

    queueMicrotask(() => {
      textarea.focus();
      textarea.setSelectionRange(caret, caret);
      this.selectionStart.set(caret);
      this.selectionEnd.set(caret);
    });
  }

  private handlePickerSelect(emoji: unknown): void {
    const record = asRecord(emoji);
    const id = asString(record["id"]);
    const native = asString(record["native"]);
    const insertion = native ?? (id ? `:${id}:` : null);

    if (!insertion) {
      return;
    }

    this.insertAtCursor(`${insertion} `);
    this.pickerOpen.set(false);
  }

  private insertAtCursor(text: string): void {
    const textarea = this.textarea()?.nativeElement;

    if (!textarea) {
      return;
    }

    const start = this.selectionStart();
    const end = this.selectionEnd();
    const nextValue = `${this.draft().slice(0, start)}${text}${this.draft().slice(end)}`;
    const caret = start + text.length;

    this.draft.set(nextValue);
    this.suggestions.set([]);
    this.suggestionContext.set(null);

    queueMicrotask(() => {
      textarea.focus();
      textarea.setSelectionRange(caret, caret);
      this.selectionStart.set(caret);
      this.selectionEnd.set(caret);
    });
  }
}

function findCommandContext(
  value: string,
  caret: number,
): SuggestionContext | null {
  const lineStart = value.lastIndexOf("\n", Math.max(caret - 1, 0)) + 1;
  const token = value.slice(lineStart, caret);

  if (!/^\/[a-z0-9-]*$/iu.test(token)) {
    return null;
  }

  return {
    kind: "command",
    start: lineStart,
    end: caret,
  };
}

function findEmojiContext(
  value: string,
  caret: number,
): SuggestionContext | null {
  const prefix = value.slice(0, caret);
  const match = /(^|[\s([{])(:[a-z0-9_+-]*)$/iu.exec(prefix);

  if (!match) {
    return null;
  }

  return {
    kind: "emoji",
    start: caret - match[2].length,
    end: caret,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value;
}
