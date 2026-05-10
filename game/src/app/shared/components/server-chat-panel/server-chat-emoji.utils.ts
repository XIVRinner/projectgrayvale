import emojiMartData from "@emoji-mart/data";
import { init, SearchIndex } from "emoji-mart";

import { type ServerChatCustomEmojiView } from "../../../core/services/server-chat.models";

interface EmojiMartSkin {
  readonly native?: string;
}

interface EmojiMartEntry {
  readonly id?: string;
  readonly name?: string;
  readonly keywords?: readonly string[];
  readonly skins?: readonly EmojiMartSkin[];
}

interface EmojiMartDataShape {
  readonly emojis: Record<
    string,
    {
      readonly id: string;
      readonly name?: string;
      readonly keywords?: readonly string[];
      readonly skins?: readonly EmojiMartSkin[];
    }
  >;
  readonly aliases: Record<string, string>;
}

export interface StandardEmojiSearchResult {
  readonly id: string;
  readonly shortcode: string;
  readonly name: string;
  readonly keywords: readonly string[];
  readonly native: string;
}

export const EMOJI_MART_DATA = emojiMartData;

const emojiData = emojiMartData as EmojiMartDataShape;
const initPromise = init({ data: emojiMartData });

export async function searchStandardEmoji(
  query: string,
  maxResults: number,
): Promise<readonly StandardEmojiSearchResult[]> {
  await initPromise;

  const results = (await SearchIndex.search(query, {
    caller: "grayvale-server-chat",
    maxResults,
  })) as readonly EmojiMartEntry[];

  return results
    .map((entry) => toStandardEmojiResult(entry))
    .filter((entry): entry is StandardEmojiSearchResult => entry !== null);
}

export function resolveStandardEmojiShortcode(
  shortcode: string,
): StandardEmojiSearchResult | null {
  const normalized = shortcode.replace(/^:+|:+$/g, "").trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  const id = emojiData.aliases[normalized] ?? normalized;
  return toStandardEmojiResult(emojiData.emojis[id] ?? null);
}

export function replaceStandardEmojiShortcodes(
  message: string,
  customEmojis: readonly ServerChatCustomEmojiView[],
): string {
  const customShortcodes = new Set(
    customEmojis.map((emoji) => emoji.shortcode.toLowerCase()),
  );

  return message.replace(/:([a-z0-9_+-]+):/giu, (match, id: string) => {
    if (customShortcodes.has(match.toLowerCase())) {
      return match;
    }

    return resolveStandardEmojiShortcode(id)?.native ?? match;
  });
}

export function buildEmojiMartCustomCategories(
  customEmojis: readonly ServerChatCustomEmojiView[],
): readonly {
  readonly id: string;
  readonly name: string;
  readonly emojis: readonly {
    readonly id: string;
    readonly name: string;
    readonly keywords: readonly string[];
    readonly skins: readonly [{ readonly src: string }];
  }[];
}[] {
  const categories = new Map<
    string,
    {
      id: string;
      name: string;
      emojis: {
        id: string;
        name: string;
        keywords: readonly string[];
        skins: readonly [{ src: string }];
      }[];
    }
  >();

  for (const emoji of customEmojis) {
    const category =
      categories.get(emoji.categoryId) ??
      {
        id: emoji.categoryId,
        name: emoji.categoryName,
        emojis: [],
      };

    category.emojis.push({
      id: emoji.id,
      name: emoji.name,
      keywords: emoji.keywords,
      skins: [{ src: emoji.src }],
    });
    categories.set(emoji.categoryId, category);
  }

  return [...categories.values()];
}

function toStandardEmojiResult(
  entry: EmojiMartEntry | null | undefined,
): StandardEmojiSearchResult | null {
  const id = entry?.id?.trim();
  const native = entry?.skins?.[0]?.native?.trim();

  if (!id || !native) {
    return null;
  }

  return {
    id,
    shortcode: `:${id}:`,
    name: entry?.name?.trim() || id,
    keywords: entry?.keywords ?? [],
    native,
  };
}
