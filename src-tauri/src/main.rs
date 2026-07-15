// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod theme;

use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::webview::WebviewWindowBuilder;
use tauri::{Manager, WebviewUrl};

fn main() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![theme::get_theme, theme::set_theme])
        .setup(|app| {
            setup_menu(app)?;
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

fn setup_menu(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let app_menu = SubmenuBuilder::new(app, "Kenvo")
        .item(
            &MenuItemBuilder::with_id("about", "About Kenvo")
                .enabled(true)
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("settings", "Settings...")
                .enabled(true)
                .accelerator("CmdOrCtrl+,")
                .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::hide(app, Some("Hide Kenvo"))?)
        .item(&PredefinedMenuItem::quit(app, Some("Quit Kenvo"))?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
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

    let app_handle = app.handle().clone();
    app.on_menu_event(move |_app, event| {
        match event.id().0.as_str() {
            "settings" => {
                if let Err(e) = open_settings_window(&app_handle) {
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

fn open_settings_window(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("settings") {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("/settings".into()))
        .title("Settings")
        .inner_size(720.0, 480.0)
        .min_inner_size(540.0, 360.0)
        .decorations(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}
