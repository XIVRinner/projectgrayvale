import { Component, computed, input } from "@angular/core";

import { type ServerChatCustomEmojiView } from "../../../../core/services/server-chat.models";
import {
  buildServerChatTextSegments,
  type ServerChatTextSegment,
} from "../server-chat-rich-text.utils";

@Component({
  selector: "gv-server-chat-rich-text",
  standalone: true,
  templateUrl: "./server-chat-rich-text.component.html",
  styleUrl: "./server-chat-rich-text.component.scss",
})
export class ServerChatRichTextComponent {
  readonly text = input.required<string>();
  readonly customEmojis = input.required<readonly ServerChatCustomEmojiView[]>();

  protected readonly segments = computed(() =>
    buildServerChatTextSegments(this.text(), this.customEmojis()),
  );

  protected trackBySegment(
    _index: number,
    segment: ServerChatTextSegment,
  ): string {
    return segment.key;
  }
}
