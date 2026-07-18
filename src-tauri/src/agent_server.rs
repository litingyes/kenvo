use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_store::StoreExt;
use tokio::sync::Mutex;

const DEFAULT_PORT: u16 = 32420;

pub struct AgentServerState {
    child: Mutex<Option<CommandChild>>,
    port: Mutex<Option<u16>>,
}

impl AgentServerState {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            child: Mutex::new(None),
            port: Mutex::new(None),
        })
    }
}

fn get_desired_port<R: Runtime>(app: &AppHandle<R>) -> u16 {
    if let Ok(store) = app.store("settings.json") {
        if let Some(value) = store.get("ai.serverPort") {
            if let Some(port) = value.as_u64() {
                if port > 0 && port <= u16::MAX as u64 {
                    return port as u16;
                }
            }
        }
    }
    DEFAULT_PORT
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AgentServerStatus {
    pub running: bool,
    pub port: Option<u16>,
}

#[tauri::command]
pub async fn agent_server_start<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, Arc<AgentServerState>>,
) -> Result<u16, String> {
    let mut child_lock = state.child.lock().await;
    if child_lock.is_some() {
        let port = *state.port.lock().await;
        return Ok(port.unwrap_or(DEFAULT_PORT));
    }

    let port = get_desired_port(&app);

    let sidecar_command = app
        .shell()
        .sidecar("agent-server")
        .map_err(|e| e.to_string())?
        .args(["--port", &port.to_string()]);

    let (mut rx, child) = sidecar_command.spawn().map_err(|e| e.to_string())?;

    let app_handle = app.clone();
    let state_for_task = Arc::clone(state.inner());
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let line = String::from_utf8_lossy(&line);
                    if let Some(port_str) = line.trim().strip_prefix("SERVER_READY port=") {
                        if let Ok(p) = port_str.parse::<u16>() {
                            *state_for_task.port.lock().await = Some(p);
                            let _ = app_handle.emit("agent-server-port", p);
                        }
                    }
                }
                CommandEvent::Stderr(line) => {
                    eprintln!("agent-server stderr: {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Terminated(payload) => {
                    eprintln!("agent-server terminated: {:?}", payload);
                    let _ = app_handle.emit("agent-server-stopped", ());
                    break;
                }
                _ => {}
            }
        }
    });

    *child_lock = Some(child);
    drop(child_lock);

    for _ in 0..50 {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        if state.port.lock().await.is_some() {
            break;
        }
    }

    let actual_port = *state.port.lock().await;
    Ok(actual_port.unwrap_or(port))
}

#[tauri::command]
pub async fn agent_server_stop(
    state: tauri::State<'_, Arc<AgentServerState>>,
) -> Result<(), String> {
    if let Some(child) = state.child.lock().await.take() {
        child.kill().map_err(|e| e.to_string())?;
    }
    *state.port.lock().await = None;
    Ok(())
}

#[tauri::command]
pub async fn agent_server_status(
    state: tauri::State<'_, Arc<AgentServerState>>,
) -> Result<AgentServerStatus, String> {
    let child_lock = state.child.lock().await;
    let port = *state.port.lock().await;
    Ok(AgentServerStatus {
        running: child_lock.is_some(),
        port,
    })
}

pub async fn maybe_start_agent_server(app: &AppHandle) {
    #[cfg(not(debug_assertions))]
    {
        if let Ok(settings) = crate::ai_settings::get_ai_settings(app) {
            if settings.server_auto_start {
                let state = app.state::<Arc<AgentServerState>>();
                let _ = agent_server_start(app.clone(), state).await;
            }
        }
    }
    let _ = app;
}
