import { TestBed } from "@angular/core/testing";

import { ServerChatGuildShellComponent } from "./server-chat-guild-shell.component";

describe("ServerChatGuildShellComponent", () => {
  it("emits invitation responses", () => {
    const fixture = TestBed.configureTestingModule({
      imports: [ServerChatGuildShellComponent],
    }).createComponent(ServerChatGuildShellComponent);

    const responses: Array<{ invitationId: string; accept: boolean }> = [];
    fixture.componentInstance.invitationResponded.subscribe((value) => responses.push(value));

    fixture.componentRef.setInput("guild", null);
    fixture.componentRef.setInput("invitations", [
      {
        id: "inv-1",
        guildId: "g1",
        guildName: "Wayfarers",
        inviterProfileId: "p1",
        createdAt: new Date().toISOString(),
      },
    ]);
    fixture.detectChanges();

    const buttons = [...fixture.nativeElement.querySelectorAll("button")] as HTMLButtonElement[];
    buttons.find((button) => button.textContent?.trim() === "Accept")?.click();
    buttons.find((button) => button.textContent?.trim() === "Reject")?.click();

    expect(responses).toEqual([
      { invitationId: "inv-1", accept: true },
      { invitationId: "inv-1", accept: false },
    ]);
  });
});
