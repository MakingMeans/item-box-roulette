import type { Item } from "../types";
import { icons } from "./icons";
import { createPlaceholder } from "./placeholder";

export const MAX_NAME_LENGTH = 80;

/**
 * Shows a modal <dialog> built from `html` and resolves with what `setup` decides.
 * `setup` gets a `finish` callback; Escape or the cancel button finish with `cancelValue`.
 */
function openDialog<T>(
  html: string,
  cancelValue: T,
  setup: (dialog: HTMLDialogElement, finish: (value: T) => void) => void,
): Promise<T> {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "dialog";
    dialog.innerHTML = html;
    document.body.append(dialog);

    let done = false;
    const finish = (value: T) => {
      if (done) return;
      done = true;
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      finish(cancelValue);
    });
    dialog.querySelector("[data-cancel]")?.addEventListener("click", () => finish(cancelValue));
    setup(dialog, finish);
    dialog.showModal();
  });
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function confirmDialog(opts: { title: string; message: string; confirmLabel: string }): Promise<boolean> {
  return openDialog(
    `<form method="dialog">
      <h2>${escapeHtml(opts.title)}</h2>
      <p class="dialog-message">${escapeHtml(opts.message)}</p>
      <div class="dialog-actions">
        <button type="button" class="button" data-cancel>Cancelar</button>
        <button type="submit" class="button button-danger">${escapeHtml(opts.confirmLabel)}</button>
      </div>
    </form>`,
    false,
    (dialog, finish) => {
      dialog.querySelector("form")!.addEventListener("submit", (e) => {
        e.preventDefault();
        finish(true);
      });
    },
  );
}

/** Asks for a name; resolves to the trimmed name, or null if cancelled. */
export function nameDialog(opts: { title: string; label: string; value?: string; confirmLabel: string }): Promise<string | null> {
  return openDialog<string | null>(
    `<form method="dialog">
      <h2>${escapeHtml(opts.title)}</h2>
      <label class="field">
        <span>${escapeHtml(opts.label)}</span>
        <input name="name" required maxlength="${MAX_NAME_LENGTH}" autocomplete="off" />
      </label>
      <div class="dialog-actions">
        <button type="button" class="button" data-cancel>Cancelar</button>
        <button type="submit" class="button button-primary">${escapeHtml(opts.confirmLabel)}</button>
      </div>
    </form>`,
    null,
    (dialog, finish) => {
      const input = dialog.querySelector("input")!;
      input.value = opts.value ?? "";
      dialog.querySelector("form")!.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = input.value.trim();
        if (name) finish(name);
        else input.focus();
      });
      queueMicrotask(() => input.select());
    },
  );
}

export interface ItemDialogDeps {
  imageUrl: (name: string) => string | null;
  /** Opens the file picker and copies the chosen image; null if the user cancelled. */
  chooseImage: () => Promise<{ name: string; fileStem: string } | null>;
  /** Deletes an image copy the dialog imported but that ended up unused. */
  discardImage: (name: string) => void;
  onError: (message: string) => void;
}

/**
 * Add/edit form for an item. Resolves to the new name and image, or null if cancelled.
 * Images picked here are copied right away; copies that end up unused are discarded,
 * while replacing the item's previous image is left to the caller once it saves.
 */
export function itemDialog(item: Item | null, deps: ItemDialogDeps): Promise<Pick<Item, "name" | "image"> | null> {
  let image = item?.image ?? null;
  let saved = false;
  // Copies made during this dialog; all but the saved one are discarded.
  const imported = new Set<string>();
  const discardUnused = (keep: string | null) => {
    for (const name of imported) if (name !== keep) deps.discardImage(name);
  };

  return openDialog<Pick<Item, "name" | "image"> | null>(
    `<form method="dialog" class="item-form">
      <h2>${item ? "Editar elemento" : "Nuevo elemento"}</h2>
      <div class="item-preview"></div>
      <div class="item-image-actions">
        <button type="button" class="button" data-choose>${icons.image}<span>Elegir imagen…</span></button>
        <button type="button" class="button" data-remove>Quitar imagen</button>
      </div>
      <label class="field">
        <span>Nombre</span>
        <input name="name" required maxlength="${MAX_NAME_LENGTH}" autocomplete="off" />
      </label>
      <div class="dialog-actions">
        <button type="button" class="button" data-cancel>Cancelar</button>
        <button type="submit" class="button button-primary">${item ? "Guardar" : "Añadir"}</button>
      </div>
    </form>`,
    null,
    (dialog, finish) => {
      const input = dialog.querySelector("input")!;
      const preview = dialog.querySelector<HTMLElement>(".item-preview")!;
      const chooseButton = dialog.querySelector<HTMLButtonElement>("[data-choose]")!;
      const removeButton = dialog.querySelector<HTMLButtonElement>("[data-remove]")!;
      input.value = item?.name ?? "";

      const renderPreview = () => {
        preview.replaceChildren();
        const url = image ? deps.imageUrl(image) : null;
        if (url) {
          const img = document.createElement("img");
          img.src = url;
          img.alt = "";
          preview.append(img);
        } else {
          preview.append(createPlaceholder({ id: item?.id ?? "new", name: input.value.trim() || "?", image: null }));
        }
        removeButton.disabled = image === null;
      };

      chooseButton.addEventListener("click", async () => {
        chooseButton.disabled = true;
        try {
          const picked = await deps.chooseImage();
          if (!picked) return;
          // The dialog went away while the file picker was open: nothing will use this copy.
          if (!dialog.isConnected) {
            deps.discardImage(picked.name);
            return;
          }
          imported.add(picked.name);
          image = picked.name;
          if (!input.value.trim()) input.value = picked.fileStem.slice(0, MAX_NAME_LENGTH);
          renderPreview();
        } catch (err) {
          deps.onError(String(err));
        } finally {
          chooseButton.disabled = false;
        }
      });
      removeButton.addEventListener("click", () => {
        image = null;
        renderPreview();
      });
      input.addEventListener("input", () => {
        if (!image) renderPreview();
      });

      dialog.querySelector("form")!.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = input.value.trim();
        if (!name) {
          input.focus();
          return;
        }
        saved = true;
        discardUnused(image);
        finish({ name, image });
      });
      // Also fires after a save, hence the flag.
      dialog.addEventListener("close", () => saved || discardUnused(null), { once: true });

      renderPreview();
      queueMicrotask(() => input.focus());
    },
  );
}
