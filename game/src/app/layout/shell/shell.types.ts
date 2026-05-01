export type ShellLayoutPreset = "story-focus" | "command-center";

export interface ShellNavItem {
  readonly label: string;
  readonly route: string;
  readonly description: string;
}

export interface ShellStatusItem {
  readonly label: string;
  readonly value: string;
}

export interface ShellActivityItem {
  readonly title: string;
  readonly detail: string;
}
