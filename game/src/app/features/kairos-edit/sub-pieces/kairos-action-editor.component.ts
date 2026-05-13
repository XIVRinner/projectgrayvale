import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { InputTextModule } from "primeng/inputtext";

import type { KairosFieldChange, KairosTagOption } from "../kairos-edit.types";
import { readStringArrayValue, readStringValue } from "../kairos-edit.utils";
import { KairosRawJsonEditorComponent } from "./kairos-raw-json-editor.component";
import { KairosTagMultiselectComponent } from "./kairos-tag-multiselect.component";

@Component({
  selector: "gv-kairos-action-editor",
  standalone: true,
  imports: [FormsModule, InputTextModule, KairosRawJsonEditorComponent, KairosTagMultiselectComponent],
  templateUrl: "./kairos-action-editor.component.html",
  styleUrl: "./kairos-item-editor.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KairosActionEditorComponent {
  readonly definition = input.required<Record<string, unknown>>();
  readonly tagOptions = input<readonly KairosTagOption[]>([]);
  readonly jsonText = input.required<string>();
  readonly jsonError = input<string | null>(null);

  readonly fieldChange = output<KairosFieldChange>();
  readonly jsonTextChange = output<string>();

  protected readString(path: readonly (string | number)[]): string {
    return readStringValue(this.definition(), path);
  }

  protected readStringArray(path: readonly (string | number)[]): string[] {
    return readStringArrayValue(this.definition(), path);
  }

  protected update(path: readonly (string | number)[], value: unknown): void {
    this.fieldChange.emit({ path, value });
  }
}
