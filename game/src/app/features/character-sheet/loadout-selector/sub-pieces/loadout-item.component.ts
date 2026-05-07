import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  input,
  output,
  signal
} from "@angular/core";
import { TooltipModule } from "primeng/tooltip";

import type { LoadoutRenameEvent, LoadoutRowView } from "../loadout-selector.types";

@Component({
  selector: "gv-loadout-item",
  standalone: true,
  imports: [TooltipModule],
  templateUrl: "./loadout-item.component.html",
  styleUrl: "./loadout-item.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadoutItemComponent {
  readonly loadout = input.required<LoadoutRowView>();

  readonly selected = output<string>();
  readonly renamed = output<LoadoutRenameEvent>();

  @ViewChild("renameInput") private readonly renameInput?: ElementRef<HTMLInputElement>;

  protected readonly isEditing = signal(false);
  protected readonly editName = signal("");

  protected readonly notesTitle = computed((): string | undefined => this.loadout().notes ?? undefined);

  protected onSelect(): void {
    if (!this.isEditing()) {
      this.selected.emit(this.loadout().id);
    }
  }

  protected startEdit(event: Event): void {
    event.stopPropagation();
    this.editName.set(this.loadout().displayName);
    this.isEditing.set(true);

    // Focus the input on the next tick after it appears in the DOM
    setTimeout(() => this.renameInput?.nativeElement.select(), 0);
  }

  protected onInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.editName.set(input.value);
  }

  protected commitRename(): void {
    const name = this.editName().trim();

    if (name.length > 0 && name !== this.loadout().displayName) {
      this.renamed.emit({ id: this.loadout().id, displayName: name });
    }

    this.isEditing.set(false);
  }

  protected cancelEdit(): void {
    this.isEditing.set(false);
  }
}
