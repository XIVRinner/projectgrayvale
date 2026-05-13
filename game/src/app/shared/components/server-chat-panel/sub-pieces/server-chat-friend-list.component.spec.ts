import { TestBed } from "@angular/core/testing";

import { ServerChatFriendListComponent } from "./server-chat-friend-list.component";

describe("ServerChatFriendListComponent", () => {
  it("emits accept/reject for pending incoming requests", () => {
    const fixture = TestBed.configureTestingModule({
      imports: [ServerChatFriendListComponent],
    }).createComponent(ServerChatFriendListComponent);

    const accepted: string[] = [];
    const rejected: string[] = [];
    fixture.componentInstance.acceptRequested.subscribe((id) => accepted.push(id));
    fixture.componentInstance.rejectRequested.subscribe((id) => rejected.push(id));

    fixture.componentRef.setInput("friendships", [
      {
        id: "f1",
        requesterProfileId: "p2",
        targetProfileId: "p1",
        counterpartProfileId: "p2",
        counterpartDisplayName: "Borin",
        counterpartOnline: true,
        type: "profile",
        status: "pending_incoming",
        updatedAt: new Date().toISOString(),
      },
    ]);
    fixture.detectChanges();

    const buttons = [...fixture.nativeElement.querySelectorAll("button")] as HTMLButtonElement[];
    buttons.find((button) => button.textContent?.trim() === "Accept")?.click();
    buttons.find((button) => button.textContent?.trim() === "Reject")?.click();

    expect(accepted).toEqual(["f1"]);
    expect(rejected).toEqual(["f1"]);
  });
});
