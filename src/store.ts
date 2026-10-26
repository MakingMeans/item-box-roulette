import * as api from "./api";
import type { AppData, Item, Roulette } from "./types";

const SAMPLE_ITEMS = ["Stranger Things", "The Office", "Breaking Bad", "Dark", "Arcane"];

function sampleData(): AppData {
  const roulette: Roulette = {
    id: crypto.randomUUID(),
    name: "Series",
    items: SAMPLE_ITEMS.map((name) => ({ id: crypto.randomUUID(), name, image: null })),
  };
  return { version: 1, roulettes: [roulette], activeRouletteId: roulette.id, sidebarOpen: true, muted: false };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Keeps whatever is valid in a parsed data.json and fills in defaults for the rest. */
function normalize(raw: unknown): AppData {
  const d = isObject(raw) ? raw : {};
  const roulettes: Roulette[] = (Array.isArray(d.roulettes) ? d.roulettes : [])
    .filter((r): r is Record<string, unknown> => isObject(r) && typeof r.id === "string" && typeof r.name === "string")
    .map((r) => ({
      id: r.id as string,
      name: r.name as string,
      items: (Array.isArray(r.items) ? r.items : [])
        .filter((i): i is Record<string, unknown> => isObject(i) && typeof i.id === "string" && typeof i.name === "string")
        .map((i) => ({ id: i.id as string, name: i.name as string, image: typeof i.image === "string" ? i.image : null })),
    }));
  const activeRouletteId = roulettes.some((r) => r.id === d.activeRouletteId)
    ? (d.activeRouletteId as string)
    : (roulettes[0]?.id ?? null);
  return { version: 1, roulettes, activeRouletteId, sidebarOpen: d.sidebarOpen !== false, muted: d.muted === true };
}

/**
 * App state plus persistence. Every mutation saves data.json and notifies listeners.
 * Image files are owned here: whoever drops the last reference to an image deletes it.
 */
export class Store {
  private listeners: Array<() => void> = [];
  private saving: Promise<void> = Promise.resolve();
  /** Called with a user-facing message when a background save or delete fails. */
  onError: (message: string) => void = console.error;

  private constructor(
    private data: AppData,
    readonly imagesDir: string,
  ) {}

  static async load(): Promise<Store> {
    const loaded = await api.loadData();
    let data: AppData;
    if (loaded.data === null) {
      data = sampleData();
    } else {
      data = normalize(JSON.parse(loaded.data));
    }
    const store = new Store(data, loaded.imagesDir);
    // Writes the sample on first run; on later runs it rewrites the normalized file.
    store.save();
    return store;
  }

  get roulettes(): readonly Roulette[] {
    return this.data.roulettes;
  }

  get active(): Roulette | null {
    return this.data.roulettes.find((r) => r.id === this.data.activeRouletteId) ?? null;
  }

  get sidebarOpen(): boolean {
    return this.data.sidebarOpen;
  }

  get muted(): boolean {
    return this.data.muted;
  }

  imageUrl(name: string | null): string | null {
    return name ? api.imageSrc(this.imagesDir, name) : null;
  }

  onChange(listener: () => void) {
    this.listeners.push(listener);
  }

  setActive(id: string) {
    this.data.activeRouletteId = id;
    this.commit();
  }

  setSidebarOpen(open: boolean) {
    this.data.sidebarOpen = open;
    this.commit();
  }

  setMuted(muted: boolean) {
    this.data.muted = muted;
    this.commit();
  }

  addRoulette(name: string): Roulette {
    const roulette: Roulette = { id: crypto.randomUUID(), name, items: [] };
    this.data.roulettes.push(roulette);
    this.data.activeRouletteId = roulette.id;
    this.commit();
    return roulette;
  }

  renameRoulette(id: string, name: string) {
    this.find(id).name = name;
    this.commit();
  }

  deleteRoulette(id: string) {
    const roulette = this.find(id);
    this.data.roulettes = this.data.roulettes.filter((r) => r !== roulette);
    if (this.data.activeRouletteId === id) this.data.activeRouletteId = this.data.roulettes[0]?.id ?? null;
    this.commit();
    for (const item of roulette.items) this.dropImage(item.image);
  }

  addItem(rouletteId: string, name: string, image: string | null) {
    this.find(rouletteId).items.push({ id: crypto.randomUUID(), name, image });
    this.commit();
  }

  /** Updates an item; if its image was replaced or removed, the old copy is deleted. */
  updateItem(rouletteId: string, itemId: string, changes: Pick<Item, "name" | "image">) {
    const item = this.findItem(rouletteId, itemId);
    const oldImage = item.image;
    item.name = changes.name;
    item.image = changes.image;
    this.commit();
    if (oldImage !== changes.image) this.dropImage(oldImage);
  }

  deleteItem(rouletteId: string, itemId: string) {
    const roulette = this.find(rouletteId);
    const item = this.findItem(rouletteId, itemId);
    roulette.items = roulette.items.filter((i) => i !== item);
    this.commit();
    this.dropImage(item.image);
  }

  /** Deletes an image copy that nothing references any more. */
  dropImage(name: string | null) {
    if (!name) return;
    api.deleteImage(name).catch((err) => this.onError(String(err)));
  }

  private find(id: string): Roulette {
    const roulette = this.data.roulettes.find((r) => r.id === id);
    if (!roulette) throw new Error(`Unknown roulette ${id}`);
    return roulette;
  }

  private findItem(rouletteId: string, itemId: string): Item {
    const item = this.find(rouletteId).items.find((i) => i.id === itemId);
    if (!item) throw new Error(`Unknown item ${itemId}`);
    return item;
  }

  private commit() {
    this.save();
    for (const listener of this.listeners) listener();
  }

  /** Saves are chained so writes never overlap and always land in order. */
  private save() {
    const json = JSON.stringify(this.data, null, 2);
    this.saving = this.saving
      .then(() => api.saveData(json))
      .catch((err) => this.onError(`No se pudieron guardar los cambios: ${err}`));
  }
}
