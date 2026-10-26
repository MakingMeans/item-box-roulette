use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Manager};

const DATA_FILE: &str = "data.json";
const IMAGES_DIR: &str = "images";
const IMAGE_EXTENSIONS: [&str; 5] = ["png", "jpg", "jpeg", "webp", "gif"];

/// The app's folder under %APPDATA%, created on first use together with its images folder.
fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(dir.join(IMAGES_DIR))
        .map_err(|e| format!("No se pudo crear la carpeta de datos: {e}"))?;
    Ok(dir)
}

/// Accepts only a bare file name, so the frontend can never reach outside the images folder.
fn image_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let is_bare = !name.is_empty() && Path::new(name).file_name().is_some_and(|f| f == name);
    if !is_bare || name.contains(['/', '\\']) {
        return Err(format!("Nombre de imagen no válido: {name}"));
    }
    Ok(data_dir(app)?.join(IMAGES_DIR).join(name))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LoadedData {
    /// Raw JSON, or None on first run.
    data: Option<String>,
    images_dir: String,
}

#[tauri::command]
fn load_data(app: AppHandle) -> Result<LoadedData, String> {
    let dir = data_dir(&app)?;
    let path = dir.join(DATA_FILE);
    let data = match fs::read(&path) {
        Ok(bytes) => match String::from_utf8(bytes) {
            Ok(text) if serde_json::from_str::<serde_json::Value>(&text).is_ok() => Some(text),
            // Unreadable file: set it aside instead of overwriting it, then start fresh.
            _ => {
                let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_secs());
                let backup = dir.join(format!("data.corrupt-{stamp}.json"));
                fs::rename(&path, &backup).map_err(|e| e.to_string())?;
                eprintln!("data.json was corrupt, moved to {}", backup.display());
                None
            }
        },
        Err(e) if e.kind() == ErrorKind::NotFound => None,
        Err(e) => return Err(format!("No se pudieron leer los datos: {e}")),
    };
    Ok(LoadedData {
        data,
        images_dir: dir.join(IMAGES_DIR).to_string_lossy().into_owned(),
    })
}

/// Writes to a temp file first and renames it over data.json, so a crash mid-write
/// never leaves a half-written file behind.
#[tauri::command]
fn save_data(app: AppHandle, json: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&json).map_err(|e| format!("JSON no válido: {e}"))?;
    let dir = data_dir(&app)?;
    let tmp = dir.join(format!("{DATA_FILE}.tmp"));
    fs::write(&tmp, json).map_err(|e| format!("No se pudieron guardar los datos: {e}"))?;
    fs::rename(&tmp, dir.join(DATA_FILE)).map_err(|e| format!("No se pudieron guardar los datos: {e}"))
}

/// Copies a picked image into the app's images folder and returns its new file name,
/// so the item keeps working if the original is moved or deleted.
#[tauri::command]
fn import_image(app: AppHandle, source: String) -> Result<String, String> {
    let source = PathBuf::from(source);
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .filter(|e| IMAGE_EXTENSIONS.contains(&e.as_str()))
        .ok_or("Formato no soportado. Usa png, jpg, webp o gif.")?;
    let name = format!("{}.{ext}", uuid::Uuid::new_v4());
    fs::copy(&source, image_path(&app, &name)?).map_err(|e| format!("No se pudo copiar la imagen: {e}"))?;
    Ok(name)
}

#[tauri::command]
fn delete_image(app: AppHandle, name: String) -> Result<(), String> {
    match fs::remove_file(image_path(&app, &name)?) {
        Err(e) if e.kind() != ErrorKind::NotFound => Err(format!("No se pudo borrar la imagen: {e}")),
        _ => Ok(()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![load_data, save_data, import_image, delete_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
