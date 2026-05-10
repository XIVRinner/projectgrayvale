import { buildServerChatTextSegments } from "./server-chat-rich-text.utils";

describe("buildServerChatTextSegments", () => {
  it("renders custom emoji shortcodes and unicode emoji as separate segments", () => {
    const result = buildServerChatTextSegments("Hello :warden: 😄", [
      {
        id: "warden",
        shortcode: ":warden:",
        name: "Warden",
        keywords: ["tank"],
        src: "assets/images/character/talent-icons/warden.png",
        categoryId: "grayvale",
        categoryName: "Gray Vale",
      },
    ]);

    expect(result).toEqual([
      { kind: "text", key: expect.any(String), text: "Hello " },
      {
        kind: "emoji",
        key: expect.any(String),
        alt: ":warden:",
        src: "assets/images/character/talent-icons/warden.png",
        title: "Warden",
        custom: true,
      },
      { kind: "text", key: expect.any(String), text: " " },
      {
        kind: "emoji",
        key: expect.any(String),
        alt: "😄",
        src: expect.stringContaining("/1f604.svg"),
        title: "😄",
        custom: false,
      },
    ]);
  });
});
