use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

#[derive(Debug, Clone, serde::Serialize)]
pub struct AppPaths {
    pub log_dir: String,
    pub data_dir: String,
}

#[tauri::command]
pub fn get_app_paths(app: tauri::AppHandle) -> Result<AppPaths, String> {
    let log_dir = app
        .path()
        .app_log_dir()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();
    Ok(AppPaths { log_dir, data_dir })
}

#[tauri::command]
pub fn open_app_folder(app: tauri::AppHandle, kind: String) -> Result<(), String> {
    let dir = match kind.as_str() {
        "log" => app.path().app_log_dir().map_err(|e| e.to_string())?,
        "data" => app.path().app_data_dir().map_err(|e| e.to_string())?,
        _ => return Err(format!("unknown folder kind: {kind}")),
    };
    app.opener()
        .open_path(dir.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| e.to_string())
}
