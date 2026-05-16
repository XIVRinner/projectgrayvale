import { DatePipe } from "@angular/common";
import { Component, input, output } from "@angular/core";
import type {
  AdminPlayerListEntryView,
  AdminProfileDetailView,
} from "../../../../core/services/server-chat.models";

@Component({
  selector: "gv-server-chat-admin-panel",
  standalone: true,
  imports: [DatePipe],
  templateUrl: "./server-chat-admin-panel.component.html",
  styleUrl: "./server-chat-admin-panel.component.scss",
})
export class ServerChatAdminPanelComponent {
  readonly entries = input.required<readonly AdminPlayerListEntryView[]>();
  readonly total = input(0);
  readonly page = input(1);
  readonly pageSize = input(20);
  readonly search = input("");
  readonly loading = input(false);
  readonly selectedProfileId = input<string | null>(null);
  readonly detail = input<AdminProfileDetailView | null>(null);
  readonly grantablePermissions = input.required<readonly string[]>();

  readonly searchChanged = output<string>();
  readonly pageChanged = output<number>();
  readonly profileSelected = output<string>();
  readonly refreshRequested = output<void>();
  readonly grantPermissionRequested = output<{
    profileId: string;
    permissionId: string;
  }>();
  readonly revokePermissionRequested = output<{
    profileId: string;
    permissionId: string;
  }>();
  readonly moderateRequested = output<{
    profileId: string;
    action: "kick" | "ban" | "unban" | "mute" | "unmute" | "warn";
  }>();
  readonly noteAdded = output<{
    profileId: string;
    body: string;
  }>();

  protected readonly pageSizeOptions = [10, 20, 50];

  protected totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / Math.max(1, this.pageSize())));
  }

  protected canPrev(): boolean {
    return this.page() > 1;
  }

  protected canNext(): boolean {
    return this.page() < this.totalPages();
  }

  protected prevPage(): void {
    if (!this.canPrev()) {
      return;
    }

    this.pageChanged.emit(this.page() - 1);
  }

  protected nextPage(): void {
    if (!this.canNext()) {
      return;
    }

    this.pageChanged.emit(this.page() + 1);
  }
}
