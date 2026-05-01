export type Id = string;

export interface Entity {
  id: Id;
}

export interface Named {
  name: string;
  description?: string;
}
