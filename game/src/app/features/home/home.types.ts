/** @deprecated replaced by HomeAdventurerSummary / HomeQuickLink */
export interface HomeSection {
  readonly title: string;
  readonly location: string;
  readonly responsibility: string;
  readonly notes: string;
}

export interface HomeAdventurerSummary {
  readonly name: string;
  readonly raceId: string;
  readonly classId: string;
  readonly level: number;
  readonly rank: string;
  readonly lastSaved: string;
}

export interface HomeQuickLink {
  readonly label: string;
  readonly description: string;
  readonly icon: string;
  readonly route: string | null;
  readonly disabled: boolean;
}
