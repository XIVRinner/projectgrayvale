import { Injectable, inject } from "@angular/core";
import { map, type Observable } from "rxjs";

import { type ServerChatCustomEmojiView } from "../../core/services/server-chat.models";
import { dataApiPath } from "../api-paths";
import { GameApiCacheService } from "../game-api-cache.service";

interface ChatEmojiCategorySource {
  readonly id: string;
  readonly name: string;
  readonly emojis: readonly ChatEmojiSource[];
}

interface ChatEmojiSource {
  readonly id: string;
  readonly name: string;
  readonly keywords: readonly string[];
  readonly src: string;
}

@Injectable({ providedIn: "root" })
export class ChatEmotesLoader {
  private readonly apiCache = inject(GameApiCacheService);

  load(): Observable<readonly ServerChatCustomEmojiView[]> {
    return this.apiCache
      .getJsonWithFallback<unknown>(
        [dataApiPath("chat-emotes"), "assets/data/chat-emotes.json"],
        { cacheKey: dataApiPath("chat-emotes") },
      )
      .pipe(map((raw) => parseChatEmotes(raw)));
  }
}

function parseChatEmotes(raw: unknown): readonly ServerChatCustomEmojiView[] {
  if (!Array.isArray(raw)) {
    throw new Error("chat-emotes.json must be an array.");
  }

  return raw.flatMap((entry, index) => {
    const category = parseChatEmojiCategory(entry, `chat-emotes[${index}]`);

    return category.emojis.map((emoji) => ({
      id: emoji.id,
      shortcode: `:${emoji.id}:`,
      name: emoji.name,
      keywords: emoji.keywords,
      src: emoji.src,
      categoryId: category.id,
      categoryName: category.name,
    }));
  });
}

function parseChatEmojiCategory(
  raw: unknown,
  label: string,
): ChatEmojiCategorySource {
  const record = ensureRecord(raw, label);

  return {
    id: ensureString(record["id"], `${label}.id`),
    name: ensureString(record["name"], `${label}.name`),
    emojis: ensureArray(record["emojis"], `${label}.emojis`).map(
      (entry, index) => parseChatEmoji(entry, `${label}.emojis[${index}]`),
    ),
  };
}

function parseChatEmoji(raw: unknown, label: string): ChatEmojiSource {
  const record = ensureRecord(raw, label);

  return {
    id: ensureString(record["id"], `${label}.id`),
    name: ensureString(record["name"], `${label}.name`),
    keywords: ensureArray(record["keywords"], `${label}.keywords`).map(
      (entry, index) => ensureString(entry, `${label}.keywords[${index}]`),
    ),
    src: ensureString(record["src"], `${label}.src`),
  };
}

function ensureRecord(raw: unknown, label: string): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${label} must be an object.`);
  }

  return raw as Record<string, unknown>;
}

function ensureArray(raw: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(raw)) {
    throw new Error(`${label} must be an array.`);
  }

  return raw;
}

function ensureString(raw: unknown, label: string): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return raw;
}
