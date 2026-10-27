export interface Item {
  id: string;
  name: string;
  /** File name of the item's image inside the app's images folder, or null to show a placeholder. */
  image: string | null;
}

export interface Roulette {
  id: string;
  name: string;
  items: Item[];
}

/** Everything persisted to data.json. */
export interface AppData {
  version: 1;
  roulettes: Roulette[];
  activeRouletteId: string | null;
  sidebarOpen: boolean;
  muted: boolean;
  spinSeconds: number;
}
