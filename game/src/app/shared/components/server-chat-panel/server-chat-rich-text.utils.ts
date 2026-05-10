import { parse } from "@twemoji/parser";

import { type ServerChatCustomEmojiView } from "../../../core/services/server-chat.models";

export type ServerChatTextSegment =
  | {
      readonly kind: "text";
      readonly key: string;
      readonly text: string;
    }
  | {
      readonly kind: "emoji";
      readonly key: string;
      readonly alt: string;
      readonly src: string;
      readonly title: string;
      readonly custom: boolean;
    };

export function buildServerChatTextSegments(
  message: string,
  customEmojis: readonly ServerChatCustomEmojiView[],
): readonly ServerChatTextSegment[] {
  const segments: ServerChatTextSegment[] = [];
  const customByShortcode = new Map(
    customEmojis.map((emoji) => [emoji.shortcode.toLowerCase(), emoji] as const),
  );
  const shortcodePattern = /:([a-z0-9_+-]+):/giu;

  let cursor = 0;
  let match: RegExpExecArray | null = shortcodePattern.exec(message);

  while (match) {
    const shortcode = match[0];
    const customEmoji = customByShortcode.get(shortcode.toLowerCase());

    if (customEmoji) {
      appendPlainTextSegments(segments, message.slice(cursor, match.index));
      segments.push({
        kind: "emoji",
        key: `emoji-${segments.length}`,
        alt: shortcode,
        src: customEmoji.src,
        title: customEmoji.name,
        custom: true,
      });
      cursor = match.index + shortcode.length;
    }

    match = shortcodePattern.exec(message);
  }

  appendPlainTextSegments(segments, message.slice(cursor));
  return segments;
}

function appendPlainTextSegments(
  segments: ServerChatTextSegment[],
  text: string,
): void {
  if (!text) {
    return;
  }

  const emojiEntities = parse(text, { assetType: "svg" });
  let cursor = 0;

  for (const entity of emojiEntities) {
    const [startIndex, endIndex] = entity.indices;

    if (startIndex > cursor) {
      segments.push({
        kind: "text",
        key: `text-${segments.length}`,
        text: text.slice(cursor, startIndex),
      });
    }

    segments.push({
      kind: "emoji",
      key: `emoji-${segments.length}`,
      alt: entity.text,
      src: entity.url,
      title: entity.text,
      custom: false,
    });
    cursor = endIndex;
  }

  if (cursor < text.length) {
    segments.push({
      kind: "text",
      key: `text-${segments.length}`,
      text: text.slice(cursor),
    });
  }
}
