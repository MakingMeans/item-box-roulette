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
