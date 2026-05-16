import { TestBed } from "@angular/core/testing";

import { ServerChatPlayerDirectoryComponent } from "./server-chat-player-directory.component";

describe("ServerChatPlayerDirectoryComponent", () => {
  it("renders online players first with online chip", () => {
    const fixture = TestBed.configureTestingModule({
      imports: [ServerChatPlayerDirectoryComponent],
    }).createComponent(ServerChatPlayerDirectoryComponent);

    fixture.componentRef.setInput("entries", [
      {
        profileId: "p-offline",
        profileDisplayName: "Offline One",
        currentCharacterName: "OfflineChar",
        online: false,
        lastOnlineAt: "2026-05-10T10:00:00.000Z",
      },
      {
        profileId: "p-online",
        profileDisplayName: "Online One",
        currentCharacterName: "OnlineChar",
        online: true,
        lastOnlineAt: "2026-05-13T10:00:00.000Z",
      },
    ]);
    fixture.detectChanges();

    const firstName = fixture.nativeElement.querySelector(
      ".gv-server-chat-player-directory__item strong",
    )?.textContent;
    const text = (fixture.nativeElement as HTMLElement).textContent ?? "";

    expect(firstName).toContain("Online One");
    expect(text).toContain("Online");
  });
});
