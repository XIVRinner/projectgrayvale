import { TestBed } from "@angular/core/testing";

import { ServerChatPlayerListComponent } from "./server-chat-player-list.component";

describe("ServerChatPlayerListComponent", () => {
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

  it("does not render inline player action buttons", () => {
    const fixture = TestBed.configureTestingModule({
      imports: [ServerChatPlayerListComponent],
    }).createComponent(ServerChatPlayerListComponent);

    fixture.componentRef.setInput("players", [
      {
        profileId: "profile-1",
        characterId: "player-1",
        playerUuid: "player-1",
        displayName: "Aerin",
        avatarPath: "assets/images/portraits/aerin.png",
        rank: "player",
        chatAccess: "allowed",
        chatAccessLabel: "Chat Open",
        serverBanned: false,
        clientId: "client-1",
        connectedAt: "2026-05-13T10:00:00.000Z",
        lastSeenAt: "2026-05-13T10:01:00.000Z",
      },
    ]);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(".gv-server-chat-player-list__action"),
    ).toBeNull();
  });
});
