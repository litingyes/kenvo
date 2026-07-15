use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_store::StoreExt;

const DEFAULT_LANGUAGE: &str = "en";
const SUPPORTED_LANGUAGES: [&str; 2] = ["en", "zh-CN"];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageSettings {
    pub language: String,
}

impl Default for LanguageSettings {
    fn default() -> Self {
        Self {
            language: DEFAULT_LANGUAGE.to_string(),
        }
    }
}

fn settings_store(
    app: &AppHandle,
) -> Result<std::sync::Arc<tauri_plugin_store::Store<tauri::Wry>>, String> {
    app.store("settings.json").map_err(|e| e.to_string())
}

pub fn get_language_settings(app: &AppHandle) -> Result<LanguageSettings, String> {
    let store = settings_store(app)?;
    let language = store
        .get("language")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| DEFAULT_LANGUAGE.to_string());

    let language = if SUPPORTED_LANGUAGES.contains(&language.as_str()) {
        language
    } else {
        DEFAULT_LANGUAGE.to_string()
    };

    Ok(LanguageSettings { language })
}

pub fn set_language_settings(app: &AppHandle, language: String) -> Result<(), String> {
    let language = if SUPPORTED_LANGUAGES.contains(&language.as_str()) {
        language
    } else {
        DEFAULT_LANGUAGE.to_string()
    };

    let store = settings_store(app)?;
    store.set("language", serde_json::Value::String(language.clone()));
    store.save().map_err(|e| e.to_string())?;
    app.emit("language-changed", LanguageSettings { language })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_language(app: AppHandle) -> Result<String, String> {
    let settings = get_language_settings(&app)?;
    Ok(settings.language)
}

#[tauri::command]
pub async fn set_language(app: AppHandle, language: String) -> Result<(), String> {
    set_language_settings(&app, language)
}

pub struct MenuLabels {
    pub app: &'static str,
    pub about: &'static str,
    pub settings: &'static str,
    pub hide: &'static str,
    pub quit: &'static str,
    pub edit: &'static str,
    pub settings_window_title: &'static str,
}

pub fn menu_labels(language: &str) -> MenuLabels {
    match language {
        "zh-CN" => MenuLabels {
            app: "Kenvo",
            about: "关于 Kenvo",
            settings: "设置...",
            hide: "隐藏 Kenvo",
            quit: "退出 Kenvo",
            edit: "编辑",
            settings_window_title: "设置",
        },
        _ => MenuLabels {
            app: "Kenvo",
            about: "About Kenvo",
            settings: "Settings...",
            hide: "Hide Kenvo",
            quit: "Quit Kenvo",
            edit: "Edit",
            settings_window_title: "Settings",
        },
    }
}
