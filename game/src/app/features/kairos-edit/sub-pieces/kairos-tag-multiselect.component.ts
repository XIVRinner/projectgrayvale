import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MultiSelectModule } from "primeng/multiselect";

import type { KairosTagOption } from "../kairos-edit.types";

@Component({
  selector: "gv-kairos-tag-multiselect",
  standalone: true,
  imports: [FormsModule, MultiSelectModule],
  templateUrl: "./kairos-tag-multiselect.component.html",
  styleUrl: "./kairos-tag-multiselect.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KairosTagMultiselectComponent {
  readonly options = input<readonly KairosTagOption[]>([]);
  readonly value = input<readonly string[]>([]);

  readonly valueChange = output<readonly string[]>();

  protected readonly mutableOptions = computed(() => [...this.options()]);
}
