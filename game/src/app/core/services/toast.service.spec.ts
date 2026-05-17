import { fakeAsync, TestBed, tick } from "@angular/core/testing";
import { MessageService } from "primeng/api";

import { ToastService } from "./toast.service";

describe("ToastService", () => {
  let service: ToastService;
  let messageService: jasmine.SpyObj<MessageService>;

  beforeEach(() => {
    messageService = jasmine.createSpyObj<MessageService>("MessageService", [
      "add",
      "clear",
    ]);

    TestBed.configureTestingModule({
      providers: [
        ToastService,
        { provide: MessageService, useValue: messageService },
      ],
    });

    service = TestBed.inject(ToastService);
  });

  it("shows immediately when position has no active toast", () => {
    service.show("level-up", { title: "Level Up", message: "Level 2" });

    expect(messageService.add).toHaveBeenCalledTimes(1);
    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({
        key: "bottom-center",
        summary: "Level Up",
      }),
    );
  });

  it("queues by position and dequeues after expiry", fakeAsync(() => {
    service.show("friend-request", { title: "Friend", message: "A sent request" });
    service.show("friend-request", { title: "Friend", message: "B sent request" });

    expect(messageService.add).toHaveBeenCalledTimes(1);

    tick(9000);

    expect(messageService.clear).toHaveBeenCalledWith("top-right");
    expect(messageService.add).toHaveBeenCalledTimes(2);
    expect(messageService.add.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({ detail: "B sent request" }),
    );
  }));

  it("keeps independent active toasts by position", () => {
    service.show("friend-request", { title: "Friend", message: "Incoming" });
    service.show("level-up", { title: "Level Up", message: "Now 3" });

    expect(messageService.add).toHaveBeenCalledTimes(2);
    expect(messageService.add.calls.argsFor(0)[0]).toEqual(
      jasmine.objectContaining({ key: "top-right" }),
    );
    expect(messageService.add.calls.argsFor(1)[0]).toEqual(
      jasmine.objectContaining({ key: "bottom-center" }),
    );
  });
});
