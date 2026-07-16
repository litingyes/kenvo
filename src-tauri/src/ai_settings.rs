use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};
use tauri_plugin_store::StoreExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderSettings {
    pub id: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSettings {
    pub server_port: u16,
    pub server_auto_start: bool,
    pub providers: Vec<AiProviderSettings>,
    pub enabled_models: HashMap<String, Vec<String>>,
}

impl Default for AiSettings {
    fn default() -> Self {
        Self {
            server_port: 32420,
            server_auto_start: true,
            providers: Vec::new(),
            enabled_models: HashMap::new(),
        }
    }
}

fn settings_store(
    app: &AppHandle,
) -> Result<std::sync::Arc<tauri_plugin_store::Store<tauri::Wry>>, String> {
    app.store("settings.json").map_err(|e| e.to_string())
}

pub fn get_ai_settings(app: &AppHandle) -> Result<AiSettings, String> {
    let store = settings_store(app)?;
    if let Some(value) = store.get("ai") {
        serde_json::from_value(value.clone()).map_err(|e| e.to_string())
    } else {
        Ok(AiSettings::default())
    }
}

pub fn set_ai_settings(app: &AppHandle, settings: &AiSettings) -> Result<(), String> {
    let store = settings_store(app)?;
    let value = serde_json::to_value(settings).map_err(|e| e.to_string())?;
    store.set("ai", value);
    store.save().map_err(|e| e.to_string())?;
    app.emit("ai-settings-changed", settings)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_ai_settings_command(app: AppHandle) -> Result<AiSettings, String> {
    get_ai_settings(&app)
}

#[tauri::command]
pub async fn set_ai_settings_command(app: AppHandle, settings: AiSettings) -> Result<(), String> {
    set_ai_settings(&app, &settings)
}
