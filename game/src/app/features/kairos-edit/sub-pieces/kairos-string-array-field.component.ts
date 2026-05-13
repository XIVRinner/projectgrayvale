import { ChangeDetectionStrategy, Component, input, output, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { InputTextModule } from "primeng/inputtext";

@Component({
  selector: "gv-kairos-string-array-field",
  standalone: true,
  imports: [FormsModule, InputTextModule],
  templateUrl: "./kairos-string-array-field.component.html",
  styleUrl: "./kairos-string-array-field.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KairosStringArrayFieldComponent {
  readonly label = input.required<string>();
  readonly placeholder = input("Add value");
  readonly values = input<readonly string[]>([]);

  readonly valuesChange = output<readonly string[]>();

  protected readonly draftValue = signal("");

  protected addValue(): void {
    const nextValue = this.draftValue().trim();

    if (!nextValue || this.values().includes(nextValue)) {
      this.draftValue.set("");
      return;
    }

    this.valuesChange.emit([...this.values(), nextValue]);
    this.draftValue.set("");
  }

  protected removeValue(value: string): void {
    this.valuesChange.emit(this.values().filter((entry) => entry !== value));
  }
}
