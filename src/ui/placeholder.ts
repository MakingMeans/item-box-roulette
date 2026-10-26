import type { Item } from "../types";

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

/** Stable hue per item, so its placeholder keeps its colour across renames. */
export function hueFor(item: Item): number {
  let hash = 0;
  for (const ch of item.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % 360;
}

/** Coloured tile with the item's initials and name, used when it has no image. */
export function createPlaceholder(item: Item): HTMLElement {
  const tile = document.createElement("div");
  tile.className = "placeholder";
  tile.style.setProperty("--hue", String(hueFor(item)));

  const letters = document.createElement("span");
  letters.className = "placeholder-initials";
  letters.textContent = initials(item.name);

  const name = document.createElement("span");
  name.className = "placeholder-name";
  name.textContent = item.name;

  tile.append(letters, name);
  return tile;
}
