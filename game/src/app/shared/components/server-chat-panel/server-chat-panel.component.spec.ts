import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { ServerChatPanelComponent } from "./server-chat-panel.component";

describe("ServerChatPanelComponent", () => {
  it("hides admin tab for non-admin sessions", () => {
    const fixture = TestBed.configureTestingModule({
      imports: [ServerChatPanelComponent],
    }).createComponent(ServerChatPanelComponent);

    setBaseInputs(fixture);
    fixture.componentRef.setInput("canShowAdminPanel", false);
    fixture.detectChanges();

    const labels = [...fixture.nativeElement.querySelectorAll(".gv-server-chat-panel__mode-tabs button")]
      .map((button: Element) => button.textContent?.trim());
    expect(labels).not.toContain("Admin");
  });

  it("shows admin tab for admin sessions", () => {
    const fixture = TestBed.configureTestingModule({
      imports: [ServerChatPanelComponent],
    }).createComponent(ServerChatPanelComponent);

    setBaseInputs(fixture);
    fixture.componentRef.setInput("canShowAdminPanel", true);
    fixture.detectChanges();

    const labels = [...fixture.nativeElement.querySelectorAll(".gv-server-chat-panel__mode-tabs button")]
      .map((button: Element) => button.textContent?.trim());
    expect(labels).toContain("Admin");
  });
});

function setBaseInputs(fixture: ComponentFixture<ServerChatPanelComponent>): void {
  fixture.componentRef.setInput("panel", {
    title: "Dev",
    subtitle: "client",
    endpointLabel: "http://localhost:3000",
    onlinePlayerCount: 0,
    isConnected: true,
    sessionRankLabel: "PLAYER",
    sessionChatAccessLabel: "allowed",
    channels: [],
    activeChannelId: null,
  });
  fixture.componentRef.setInput("players", []);
  fixture.componentRef.setInput("messages", []);
  fixture.componentRef.setInput("customEmojis", []);
  fixture.componentRef.setInput("commands", []);
  fixture.componentRef.setInput("channels", []);
  fixture.componentRef.setInput("canSend", true);
  fixture.componentRef.setInput("isSending", false);
  fixture.componentRef.setInput("adminEntries", []);
  fixture.componentRef.setInput("grantablePermissions", []);
  fixture.componentRef.setInput("socialPlayers", []);
  fixture.componentRef.setInput("friendships", []);
  fixture.componentRef.setInput("guildInvitations", []);
}
