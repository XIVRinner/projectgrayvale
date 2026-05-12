import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ShellFooterComponent } from "./shell-footer.component";

describe("ShellFooterComponent", () => {
  let fixture: ComponentFixture<ShellFooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShellFooterComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ShellFooterComponent);
    fixture.componentRef.setInput("serverSummary", {
      label: "GrayVale Cloud",
      detail: "2 online - Connected as ADMIN",
      onlinePlayerCount: 2,
      isConnected: true
    });
  });

  it("hides Kairos Edit by default until admin status is confirmed", () => {
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain("Kairos Edit");
  });

  it("renders Kairos Edit when admin status is confirmed", () => {
    fixture.componentRef.setInput("canOpenKairosEdit", true);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain("Kairos Edit");
  });
});
