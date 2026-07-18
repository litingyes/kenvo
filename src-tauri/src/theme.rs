use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_store::StoreExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeSettings {
    pub mode: String,
    pub preset: String,
}

impl Default for ThemeSettings {
    fn default() -> Self {
        Self {
            mode: "dark".to_string(),
            preset: "kenvo".to_string(),
        }
    }
}

fn settings_store(
    app: &AppHandle,
) -> Result<std::sync::Arc<tauri_plugin_store::Store<tauri::Wry>>, String> {
    app.store("settings.json").map_err(|e| e.to_string())
}

pub fn get_theme_settings(app: &AppHandle) -> Result<ThemeSettings, String> {
    let store = settings_store(app)?;
    let mode = store
        .get("theme.mode")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "dark".to_string());
    let valid_presets = ["kenvo", "ayu", "catppuccin"];
    let preset = store
        .get("theme.preset")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .filter(|p| valid_presets.contains(&p.as_str()))
        .unwrap_or_else(|| "kenvo".to_string());
    Ok(ThemeSettings { mode, preset })
}

pub fn set_theme_settings(app: &AppHandle, settings: &ThemeSettings) -> Result<(), String> {
    let store = settings_store(app)?;
    store.set(
        "theme.mode",
        serde_json::Value::String(settings.mode.clone()),
    );
    store.set(
        "theme.preset",
        serde_json::Value::String(settings.preset.clone()),
    );
    store.save().map_err(|e| e.to_string())?;
    app.emit("theme-changed", settings)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_theme(app: AppHandle) -> Result<ThemeSettings, String> {
    get_theme_settings(&app)
}

#[tauri::command]
pub async fn set_theme(app: AppHandle, mode: String, preset: String) -> Result<(), String> {
    let settings = ThemeSettings { mode, preset };
    set_theme_settings(&app, &settings)
}
