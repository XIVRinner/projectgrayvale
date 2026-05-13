import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "gv-kairos-raw-json-editor",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./kairos-raw-json-editor.component.html",
  styleUrl: "./kairos-raw-json-editor.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KairosRawJsonEditorComponent {
  readonly label = input("Definition JSON");
  readonly value = input.required<string>();
  readonly error = input<string | null>(null);

  readonly valueChange = output<string>();
}
