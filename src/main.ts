import * as api from "./api";
import { SoundPlayer } from "./sound";
import { Store } from "./store";
import { confirmDialog, itemDialog, nameDialog, type ItemDialogDeps } from "./ui/dialogs";
import { icons } from "./ui/icons";
import { RouletteView } from "./ui/rouletteView";
import { Sidebar } from "./ui/sidebar";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <div class="layout">
    <aside class="sidebar" aria-label="Ruletas"></aside>
    <main class="stage">
      <div class="stage-backdrop" aria-hidden="true"></div>
      <div class="stage-toolbar">
        <button class="icon-button sidebar-toggle" type="button"></button>
        <button class="icon-button mute-button" type="button"></button>
      </div>
      <div class="stage-content">
        <h1 class="roulette-title"></h1>
        <section class="roulette"></section>
      </div>
    </main>
  </div>
  <div class="toast" role="status" hidden></div>
`;

const layout = app.querySelector<HTMLElement>(".layout")!;
const sidebarEl = app.querySelector<HTMLElement>(".sidebar")!;
const title = app.querySelector<HTMLElement>(".roulette-title")!;
const toggleButton = app.querySelector<HTMLButtonElement>(".sidebar-toggle")!;
const muteButton = app.querySelector<HTMLButtonElement>(".mute-button")!;
const toast = app.querySelector<HTMLElement>(".toast")!;

let toastTimer: number | undefined;
function showToast(message: string) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.hidden = true), 5000);
}

let store: Store;
try {
  store = await Store.load();
} catch (err) {
  title.textContent = "No se pudieron cargar los datos";
  showToast(String(err));
  throw err;
}
store.onError = showToast;

const sound = new SoundPlayer(store.muted);
let spinning = false;
const view = new RouletteView(
  app.querySelector(".roulette")!,
  sound,
  (item) => store.imageUrl(item.image),
  (isSpinning) => {
    spinning = isSpinning;
    updateSidebarAccess();
  },
);

const itemDeps: ItemDialogDeps = {
  imageUrl: (name) => store.imageUrl(name),
  chooseImage: async () => {
    const path = await api.pickImageFile();
    if (!path) return null;
    const name = await api.importImage(path);
    const fileStem = path.split(/[\\/]/).pop()!.replace(/\.[^.]+$/, "");
    return { name, fileStem };
  },
  discardImage: (name) => store.dropImage(name),
  onError: showToast,
};

const sidebar = new Sidebar(sidebarEl, store, {
  selectRoulette: (roulette) => store.setActive(roulette.id),
  newRoulette: async () => {
    const name = await nameDialog({ title: "Nueva ruleta", label: "Nombre", confirmLabel: "Crear" });
    if (name) store.addRoulette(name);
  },
  renameRoulette: async (roulette) => {
    const name = await nameDialog({
      title: "Renombrar ruleta",
      label: "Nombre",
      value: roulette.name,
      confirmLabel: "Guardar",
    });
    if (name) store.renameRoulette(roulette.id, name);
  },
  deleteRoulette: async (roulette) => {
    const count = roulette.items.length;
    const ok = await confirmDialog({
      title: "Borrar ruleta",
      message: `Se borrará «${roulette.name}» y ${count === 1 ? "su elemento" : `sus ${count} elementos`}. No se puede deshacer.`,
      confirmLabel: "Borrar",
    });
    if (ok) store.deleteRoulette(roulette.id);
  },
  addItem: async (roulette) => {
    const result = await itemDialog(null, itemDeps);
    if (result) store.addItem(roulette.id, result.name, result.image);
  },
  editItem: async (roulette, item) => {
    const result = await itemDialog(item, itemDeps);
    if (result) store.updateItem(roulette.id, item.id, result);
  },
  deleteItem: (roulette, item) => store.deleteItem(roulette.id, item.id),
});

// The panel can't be used while spinning (editing mid-spin would swap the box's faces),
// nor reached by keyboard while collapsed.
function updateSidebarAccess() {
  sidebarEl.inert = spinning || !store.sidebarOpen;
  sidebarEl.classList.toggle("busy", spinning);
}

/** Only rebuilds the box when the active roulette or its items actually changed. */
let shownItemsKey = "";
function syncView() {
  const active = store.active;
  title.textContent = active?.name ?? "Sin ruletas";
  const key = JSON.stringify(active ? [active.id, active.items] : null);
  if (key === shownItemsKey) return;
  shownItemsKey = key;
  view.setItems(active?.items ?? [], active ? undefined : "Crea una ruleta en el panel para empezar");
}

function render() {
  layout.classList.toggle("sidebar-closed", !store.sidebarOpen);
  toggleButton.innerHTML = icons.panel;
  toggleButton.title = store.sidebarOpen ? "Ocultar panel" : "Mostrar panel";
  toggleButton.setAttribute("aria-expanded", String(store.sidebarOpen));

  muteButton.innerHTML = store.muted ? icons.speakerOff : icons.speakerOn;
  muteButton.title = store.muted ? "Activar sonido" : "Silenciar";
  muteButton.setAttribute("aria-pressed", String(store.muted));
  sound.setMuted(store.muted);

  updateSidebarAccess();
  sidebar.render();
  syncView();
}

toggleButton.addEventListener("click", () => store.setSidebarOpen(!store.sidebarOpen));
muteButton.addEventListener("click", () => store.setMuted(!store.muted));
store.onChange(render);
render();

function isTextInput(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"));
}

// The WebView's own context menu (reload, print…) makes no sense in a desktop app;
// text fields keep it for copy/paste.
window.addEventListener("contextmenu", (event) => {
  if (!isTextInput(event.target)) event.preventDefault();
});

window.addEventListener("keydown", (event) => {
  if (event.code !== "Space" || event.repeat || isTextInput(event.target)) return;
  if (document.querySelector("dialog[open]")) return;
  // Also stops a focused button from treating Space as its own click.
  event.preventDefault();
  void view.spin();
});
