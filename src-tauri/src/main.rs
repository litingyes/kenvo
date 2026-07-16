// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod agent_server;
mod ai_settings;
mod language;
mod theme;

use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::webview::WebviewWindowBuilder;
use tauri::{Listener, Manager, WebviewUrl};

fn main() {
    let mut builder = tauri::Builder::default()
        .manage(agent_server::AgentServerState::new())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            theme::get_theme,
            theme::set_theme,
            language::get_language,
            language::set_language,
            agent_server::agent_server_start,
            agent_server::agent_server_stop,
            agent_server::agent_server_status,
            ai_settings::get_ai_settings_command,
            ai_settings::set_ai_settings_command,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            setup_menu(&app_handle)?;

            let app_handle_for_server = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                agent_server::maybe_start_agent_server(&app_handle_for_server).await;
            });

            app.listen("language-changed", move |_event| {
                if let Err(e) = setup_menu(&app_handle) {
                    eprintln!("failed to rebuild menu: {}", e);
                }
            });

            Ok(())
        });

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_pilot::init());
    }

    builder
        .run(tauri::generate_context!())
        .expect("error running app");
}

fn setup_menu(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let language = language::get_language_settings(app)?.language;
    let labels = language::menu_labels(&language);

    let app_menu = SubmenuBuilder::new(app, labels.app)
        .item(
            &MenuItemBuilder::with_id("about", labels.about)
                .enabled(true)
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("settings", labels.settings)
                .enabled(true)
                .accelerator("CmdOrCtrl+,")
                .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::hide(app, Some(labels.hide))?)
        .item(&PredefinedMenuItem::quit(app, Some(labels.quit))?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, labels.edit)
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .build()?;

    let menu = MenuBuilder::new(app)
        .item(&app_menu)
        .item(&edit_menu)
        .build()?;

    app.set_menu(menu)?;

    let menu_language = language.clone();
    let app_handle = app.clone();
    app.on_menu_event(move |_app, event| {
        match event.id().0.as_str() {
            "settings" => {
                if let Err(e) = open_settings_window(&app_handle, &menu_language) {
                    eprintln!("failed to open settings window: {}", e);
                }
            }
            "about" => {
                // Intentionally left empty; the OS provides a default About dialog.
            }
            _ => {}
        }
    });

    Ok(())
}

fn open_settings_window(app: &tauri::AppHandle, language: &str) -> Result<(), String> {
    let labels = language::menu_labels(language);

    if let Some(window) = app.get_webview_window("settings") {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("/settings".into()))
        .title(labels.settings_window_title)
        .inner_size(720.0, 480.0)
        .min_inner_size(540.0, 360.0)
        .decorations(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}
