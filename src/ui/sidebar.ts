import type { Store } from "../store";
import type { Item, Roulette } from "../types";
import { icons } from "./icons";
import { hueFor, initials } from "./placeholder";

export interface SidebarActions {
  selectRoulette(roulette: Roulette): void;
  newRoulette(): void;
  renameRoulette(roulette: Roulette): void;
  deleteRoulette(roulette: Roulette): void;
  addItem(roulette: Roulette): void;
  editItem(roulette: Roulette, item: Item): void;
  deleteItem(roulette: Roulette, item: Item): void;
}

function iconButton(icon: string, title: string, onClick: () => void, extraClass = ""): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `icon-button small ${extraClass}`.trim();
  button.title = title;
  button.setAttribute("aria-label", title);
  button.innerHTML = icon;
  button.addEventListener("click", onClick);
  return button;
}

/** Collapsible left panel: the list of roulettes and the items of the active one. */
export class Sidebar {
  private readonly rouletteList: HTMLUListElement;
  private readonly roulettesEmpty: HTMLElement;
  private readonly itemsTitle: HTMLElement;
  private readonly itemList: HTMLUListElement;
  private readonly itemsEmpty: HTMLElement;
  private readonly addItemButton: HTMLButtonElement;

  constructor(
    root: HTMLElement,
    private readonly store: Store,
    private readonly actions: SidebarActions,
  ) {
    root.innerHTML = `
      <section class="panel-section">
        <header class="section-header">
          <h2>Ruletas</h2>
        </header>
        <ul class="roulette-list"></ul>
        <p class="empty-note" data-empty="roulettes">No hay ruletas. Crea una con el botón +.</p>
      </section>
      <section class="panel-section items-section">
        <header class="section-header">
          <h2 class="items-title"></h2>
        </header>
        <ul class="item-list"></ul>
        <p class="empty-note" data-empty="items">Todavía no hay elementos. Añade al menos 2 para girar.</p>
      </section>
    `;
    this.rouletteList = root.querySelector(".roulette-list")!;
    this.roulettesEmpty = root.querySelector('[data-empty="roulettes"]')!;
    this.itemsTitle = root.querySelector(".items-title")!;
    this.itemList = root.querySelector(".item-list")!;
    this.itemsEmpty = root.querySelector('[data-empty="items"]')!;

    const [roulettesHeader, itemsHeader] = root.querySelectorAll(".section-header");
    roulettesHeader.append(iconButton(icons.plus, "Nueva ruleta", () => actions.newRoulette()));
    this.addItemButton = iconButton(icons.plus, "Añadir elemento", () => {
      const active = this.store.active;
      if (active) actions.addItem(active);
    });
    itemsHeader.append(this.addItemButton);
  }

  render() {
    const active = this.store.active;

    this.rouletteList.replaceChildren(...this.store.roulettes.map((r) => this.rouletteRow(r, r === active)));
    this.roulettesEmpty.hidden = this.store.roulettes.length > 0;

    this.itemsTitle.textContent = active ? `Elementos · ${active.name}` : "Elementos";
    this.addItemButton.disabled = !active;
    this.itemList.replaceChildren(...(active ? active.items.map((item) => this.itemRow(active, item)) : []));
    this.itemsEmpty.hidden = !active || active.items.length > 0;
  }

  private rouletteRow(roulette: Roulette, isActive: boolean): HTMLLIElement {
    const row = document.createElement("li");
    row.className = "row roulette-row";
    row.classList.toggle("active", isActive);

    const select = document.createElement("button");
    select.type = "button";
    select.className = "row-main";
    select.setAttribute("aria-current", String(isActive));
    const name = document.createElement("span");
    name.className = "row-name";
    name.textContent = roulette.name;
    const count = document.createElement("span");
    count.className = "row-count";
    count.textContent = String(roulette.items.length);
    select.append(name, count);
    select.addEventListener("click", () => this.actions.selectRoulette(roulette));

    row.append(
      select,
      iconButton(icons.pencil, "Renombrar ruleta", () => this.actions.renameRoulette(roulette)),
      iconButton(icons.trash, "Borrar ruleta", () => this.actions.deleteRoulette(roulette), "danger"),
    );
    return row;
  }

  private itemRow(roulette: Roulette, item: Item): HTMLLIElement {
    const row = document.createElement("li");
    row.className = "row item-row";

    const thumb = document.createElement("span");
    thumb.className = "thumb";
    const url = this.store.imageUrl(item.image);
    if (url) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      img.loading = "lazy";
      thumb.append(img);
    } else {
      thumb.classList.add("thumb-placeholder");
      thumb.style.setProperty("--hue", String(hueFor(item)));
      thumb.textContent = initials(item.name);
    }

    const name = document.createElement("span");
    name.className = "row-name";
    name.textContent = item.name;
    name.title = item.name;

    row.append(
      thumb,
      name,
      iconButton(icons.pencil, "Editar elemento", () => this.actions.editItem(roulette, item)),
      iconButton(icons.trash, "Borrar elemento", () => this.actions.deleteItem(roulette, item), "danger"),
    );
    return row;
  }
}
