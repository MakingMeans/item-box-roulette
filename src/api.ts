// Thin wrappers over the Rust commands in src-tauri/src/lib.rs.
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"];

export interface LoadedData {
  data: string | null;
  imagesDir: string;
}

export const loadData = () => invoke<LoadedData>("load_data");
export const saveData = (json: string) => invoke<void>("save_data", { json });
export const importImage = (source: string) => invoke<string>("import_image", { source });
export const deleteImage = (name: string) => invoke<void>("delete_image", { name });

/** Opens the native file picker; resolves to the chosen path or null if cancelled. */
export function pickImageFile(): Promise<string | null> {
  return open({
    multiple: false,
    directory: false,
    filters: [{ name: "Imágenes", extensions: IMAGE_EXTENSIONS }],
  });
}

export function imageSrc(imagesDir: string, name: string): string {
  const sep = imagesDir.includes("\\") ? "\\" : "/";
  return convertFileSrc(`${imagesDir}${sep}${name}`);
}
