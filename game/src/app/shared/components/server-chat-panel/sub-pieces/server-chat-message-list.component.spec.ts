import { TestBed } from "@angular/core/testing";

import { ServerChatMessageListComponent } from "./server-chat-message-list.component";

describe("ServerChatMessageListComponent", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  it("renders system messages without inline action buttons or portraits", () => {
    const fixture = TestBed.configureTestingModule({
      imports: [ServerChatMessageListComponent],
    }).createComponent(ServerChatMessageListComponent);

    fixture.componentRef.setInput("messages", [
      {
        id: "msg-system",
        channelId: "system",
        channelType: "system",
        messageType: "system",
        playerUuid: "system",
        displayName: "System",
        rank: "admin",
        chatAccess: "allowed",
        chatAccessLabel: "System",
        serverBanned: false,
        message: "The shard hums awake.",
        createdAt: "2026-05-13T10:00:00.000Z",
        sender: {
          profileId: "system",
          profileDisplayName: "System",
          online: true,
          badges: [],
        },
      },
    ]);
    fixture.componentRef.setInput("customEmojis", []);
    fixture.detectChanges();

    const entry = fixture.nativeElement.querySelector(
      ".gv-server-chat-message-list__entry",
    ) as HTMLElement | null;

    expect(entry?.classList.contains("gv-server-chat-message-list__entry--system")).toBe(true);
    expect(
      entry?.querySelector(".gv-server-chat-message-list__portrait-box"),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector(".gv-server-chat-message-list__action"),
    ).toBeNull();
  });
});
