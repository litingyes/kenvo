use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::Duration;

use chrono::{DateTime, Local, NaiveDate, NaiveDateTime, NaiveTime, TimeZone, Utc};
use regex::Regex;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, Runtime};
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};
use tokio::time::sleep;

const DEFAULT_MAX_INITIAL_LINES: usize = 500;
const DEFAULT_MAX_INITIAL_BYTES: usize = 1024 * 1024;
const DEFAULT_POLL_INTERVAL_MS: u64 = 500;
const MESSAGE_PREVIEW_LEN: usize = 200;
const MAX_LINE_LENGTH: usize = 50_000;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum LogSource {
    App,
    AgentServer,
    AiConversations,
}

impl LogSource {
    fn file_name(&self) -> &'static str {
        match self {
            LogSource::App => "kenvo.log",
            LogSource::AgentServer => "agent-server.log",
            LogSource::AiConversations => "ai-conversations.jsonl",
        }
    }

    fn dir_kind(&self) -> &'static str {
        match self {
            LogSource::App | LogSource::AgentServer => "log",
            LogSource::AiConversations => "data",
        }
    }

    fn path<R: Runtime>(&self, app: &AppHandle<R>) -> Result<PathBuf, String> {
        let dir = match self.dir_kind() {
            "log" => app.path().app_log_dir(),
            "data" => app.path().app_data_dir(),
            _ => unreachable!(),
        }
        .map_err(|e| e.to_string())?;
        Ok(dir.join(self.file_name()))
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogLine {
    pub source: LogSource,
    pub timestamp: String,
    pub timestamp_ms: i64,
    pub level: String,
    pub target: Option<String>,
    pub message: String,
    pub raw: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum LogStreamEvent {
    Initial { source: LogSource, lines: Vec<LogLine> },
    NewLines { source: LogSource, lines: Vec<LogLine> },
    Reset { source: LogSource, lines: Vec<LogLine> },
    Error { source: LogSource, message: String },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamOptions {
    pub max_initial_lines: Option<usize>,
    pub tail: Option<bool>,
}

#[derive(Default)]
pub struct LogStreamState {
    cancel_flags: Mutex<HashMap<String, Arc<AtomicBool>>>,
    next_id: AtomicU64,
}

impl LogStreamState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert(&self) -> (String, Arc<AtomicBool>) {
        let id = format!("log-stream-{}", self.next_id.fetch_add(1, Ordering::SeqCst));
        let flag = Arc::new(AtomicBool::new(false));
        self.cancel_flags.lock().unwrap().insert(id.clone(), flag.clone());
        (id, flag)
    }

    pub fn stop(&self, id: &str) -> bool {
        if let Some(flag) = self.cancel_flags.lock().unwrap().remove(id) {
            flag.store(true, Ordering::Relaxed);
            true
        } else {
            false
        }
    }

    pub fn remove(&self, id: &str) {
        self.cancel_flags.lock().unwrap().remove(id);
    }
}

#[tauri::command]
pub async fn stream_log<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, LogStreamState>,
    channel: Channel<LogStreamEvent>,
    sources: Vec<LogSource>,
    options: StreamOptions,
) -> Result<String, String> {
    let (stream_id, cancel) = state.insert();
    let stream_id_for_task = stream_id.clone();
    let app_for_task = app.clone();

    tauri::async_runtime::spawn(async move {
        let result = run_stream(app_for_task.clone(), &channel, &sources, options, &cancel).await;
        if let Err(e) = result {
            let _ = channel.send(LogStreamEvent::Error {
                source: LogSource::App,
                message: e,
            });
        }
        app_for_task
            .state::<LogStreamState>()
            .remove(&stream_id_for_task);
    });

    Ok(stream_id)
}

#[tauri::command]
pub fn stop_log_stream(state: tauri::State<'_, LogStreamState>, stream_id: String) -> Result<(), String> {
    state.stop(&stream_id);
    Ok(())
}

#[tauri::command]
pub async fn export_log<R: Runtime>(
    app: AppHandle<R>,
    source: LogSource,
    dest_path: String,
) -> Result<(), String> {
    let src = source.path(&app)?;
    fs::copy(&src, &dest_path)
        .await
        .map_err(|e| format!("failed to export log: {e}"))?;
    Ok(())
}

async fn run_stream<R: Runtime>(
    app: AppHandle<R>,
    channel: &Channel<LogStreamEvent>,
    sources: &[LogSource],
    options: StreamOptions,
    cancel: &Arc<AtomicBool>,
) -> Result<(), String> {
    let max_initial_lines = options.max_initial_lines.unwrap_or(DEFAULT_MAX_INITIAL_LINES);
    let tail = options.tail.unwrap_or(true);
    let interval = Duration::from_millis(DEFAULT_POLL_INTERVAL_MS);

    let mut source_states: Vec<(LogSource, PathBuf, u64, String)> = Vec::with_capacity(sources.len());

    for source in sources {
        let path = source.path(&app)?;
        match read_tail_lines(&path, DEFAULT_MAX_INITIAL_BYTES, max_initial_lines).await {
            Ok(lines) => {
                let parsed: Vec<LogLine> = lines
                    .iter()
                    .filter_map(|line| parse_line(*source, line))
                    .collect();
                if channel
                    .send(LogStreamEvent::Initial {
                        source: *source,
                        lines: parsed,
                    })
                    .is_err()
                {
                    return Ok(());
                }
                let size = fs::metadata(&path).await.map(|m| m.len()).unwrap_or(0);
                source_states.push((*source, path, size, String::new()));
            }
            Err(e) => {
                let _ = channel.send(LogStreamEvent::Error {
                    source: *source,
                    message: e,
                });
                source_states.push((*source, path, 0, String::new()));
            }
        }
    }

    if !tail {
        return Ok(());
    }

    loop {
        sleep(interval).await;
        if cancel.load(Ordering::Relaxed) {
            break;
        }

        for (source, path, pos, pending) in &mut source_states {
            match read_new_data(path, *pos, pending).await {
                Ok((lines, new_pos, rotated)) => {
                    *pos = new_pos;
                    if lines.is_empty() {
                        continue;
                    }
                    let parsed: Vec<LogLine> = lines
                        .iter()
                        .filter_map(|line| parse_line(*source, line))
                        .collect();
                    let event = if rotated {
                        LogStreamEvent::Reset {
                            source: *source,
                            lines: parsed,
                        }
                    } else {
                        LogStreamEvent::NewLines {
                            source: *source,
                            lines: parsed,
                        }
                    };
                    if channel.send(event).is_err() {
                        return Ok(());
                    }
                }
                Err(e) => {
                    let _ = channel.send(LogStreamEvent::Error {
                        source: *source,
                        message: e,
                    });
                }
            }
        }
    }

    Ok(())
}

async fn read_tail_lines(
    path: &Path,
    max_bytes: usize,
    max_lines: usize,
) -> Result<Vec<String>, String> {
    let metadata = fs::metadata(path)
        .await
        .map_err(|e| format!("failed to read log metadata: {e}"))?;
    let size = metadata.len();
    if size == 0 {
        return Ok(Vec::new());
    }

    let start = if size <= max_bytes as u64 {
        0
    } else {
        size - max_bytes as u64
    };

    let mut file = fs::File::open(path)
        .await
        .map_err(|e| format!("failed to open log file: {e}"))?;
    file.seek(SeekFrom::Start(start))
        .await
        .map_err(|e| format!("failed to seek log file: {e}"))?;

    let mut buf = vec![0u8; (size - start) as usize];
    file.read_exact(&mut buf)
        .await
        .map_err(|e| format!("failed to read log file: {e}"))?;

    let text = String::from_utf8_lossy(&buf);
    let mut lines: Vec<String> = text.split('\n').map(|s| s.to_string()).collect();
    if start > 0 && !lines.is_empty() {
        lines.remove(0);
    }
    if lines.len() > max_lines {
        let split_at = lines.len() - max_lines;
        lines = lines.split_off(split_at);
    }
    Ok(lines)
}

async fn read_new_data(
    path: &Path,
    last_pos: u64,
    pending: &mut String,
) -> Result<(Vec<String>, u64, bool), String> {
    let metadata = fs::metadata(path)
        .await
        .map_err(|e| format!("failed to read log metadata: {e}"))?;
    let size = metadata.len();

    if size < last_pos {
        pending.clear();
        let lines = read_tail_lines(path, DEFAULT_MAX_INITIAL_BYTES, DEFAULT_MAX_INITIAL_LINES).await?;
        return Ok((lines, size, true));
    }

    if size == last_pos {
        return Ok((Vec::new(), last_pos, false));
    }

    let mut file = fs::File::open(path)
        .await
        .map_err(|e| format!("failed to open log file: {e}"))?;
    file.seek(SeekFrom::Start(last_pos))
        .await
        .map_err(|e| format!("failed to seek log file: {e}"))?;

    let mut buf = Vec::with_capacity((size - last_pos) as usize);
    file.read_to_end(&mut buf)
        .await
        .map_err(|e| format!("failed to read log file: {e}"))?;

    let text = String::from_utf8_lossy(&buf);
    let combined = std::mem::take(pending) + &text;
    let mut lines: Vec<String> = combined.split('\n').map(|s| s.to_string()).collect();

    if combined.ends_with('\n') {
        *pending = String::new();
    } else if let Some(last) = lines.pop() {
        *pending = last;
    } else {
        *pending = String::new();
    }

    Ok((lines, size, false))
}

static APP_LOG_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^\[(\d{4}-\d{2}-\d{2})\]\[(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\]\[(\w+)\]\[(.*?)\]\s*(.*)$")
        .unwrap()
});

static AGENT_LOG_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)\s+\[(\w+)\]\s+(.*)$")
        .unwrap()
});

fn parse_line(source: LogSource, raw: &str) -> Option<LogLine> {
    let trimmed = raw.trim_end_matches('\r');
    if trimmed.trim().is_empty() {
        return None;
    }
    let raw = if raw.len() > MAX_LINE_LENGTH {
        format!("{}...(truncated)", &raw[..MAX_LINE_LENGTH])
    } else {
        raw.to_string()
    };

    match source {
        LogSource::App => parse_app_line(&raw),
        LogSource::AgentServer => parse_agent_line(&raw),
        LogSource::AiConversations => parse_ai_line(&raw),
    }
}

fn parse_app_line(raw: &str) -> Option<LogLine> {
    let caps = APP_LOG_RE.captures(raw)?;
    let date_str = caps.get(1)?.as_str();
    let time_str = caps.get(2)?.as_str();
    let level = caps.get(3)?.as_str().to_uppercase();
    let target = caps.get(4)?.as_str();
    let message = caps.get(5)?.as_str().to_string();

    let date = NaiveDate::parse_from_str(date_str, "%Y-%m-%d").ok()?;
    let time = NaiveTime::parse_from_str(time_str, "%H:%M:%S%.f").ok()?;
    let naive = NaiveDateTime::new(date, time);
    let dt = Local
        .from_local_datetime(&naive)
        .earliest()
        .unwrap_or_else(|| Local.from_utc_datetime(&naive));

    Some(LogLine {
        source: LogSource::App,
        timestamp: dt.to_rfc3339(),
        timestamp_ms: dt.timestamp_millis(),
        level,
        target: if target.is_empty() { None } else { Some(target.to_string()) },
        message: truncate_message(message),
        raw: raw.to_string(),
    })
}

fn parse_agent_line(raw: &str) -> Option<LogLine> {
    let caps = AGENT_LOG_RE.captures(raw)?;
    let ts_str = caps.get(1)?.as_str();
    let level = caps.get(2)?.as_str().to_uppercase();
    let rest = caps.get(3)?.as_str();

    let dt = DateTime::parse_from_rfc3339(ts_str)
        .or_else(|_| DateTime::parse_from_str(ts_str, "%+"))
        .ok()?;
    let dt_utc = dt.with_timezone(&Utc);

    let (message, target) = split_agent_rest(rest);

    Some(LogLine {
        source: LogSource::AgentServer,
        timestamp: dt_utc.to_rfc3339(),
        timestamp_ms: dt_utc.timestamp_millis(),
        level,
        target,
        message: truncate_message(message),
        raw: raw.to_string(),
    })
}

fn split_agent_rest(rest: &str) -> (String, Option<String>) {
    let trimmed = rest.trim_end();
    if let Some(brace_pos) = trimmed.rfind('{') {
        let (msg_part, json_part) = trimmed.split_at(brace_pos);
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(json_part) {
            let target = json
                .get("agentId")
                .or_else(|| json.get("task"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            return (msg_part.trim().to_string(), target);
        }
    }
    (trimmed.to_string(), None)
}

fn parse_ai_line(raw: &str) -> Option<LogLine> {
    let json = serde_json::from_str::<serde_json::Value>(raw).ok()?;
    let ts_str = json.get("ts")?.as_str()?;
    let dt = DateTime::parse_from_rfc3339(ts_str)
        .or_else(|_| DateTime::parse_from_str(ts_str, "%+"))
        .ok()?;
    let dt_utc = dt.with_timezone(&Utc);

    let ty = json.get("type").and_then(|v| v.as_str()).unwrap_or("unknown");
    let level = match ty {
        "error" => "ERROR",
        "warning" | "warn" => "WARN",
        "conversation" => "DEBUG",
        _ => "INFO",
    }
    .to_string();

    let operation_id = json
        .get("operationId")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let provider = json.get("provider").and_then(|v| v.as_str()).unwrap_or("");
    let model = json.get("modelId").and_then(|v| v.as_str()).unwrap_or("");
    let call_id = json.get("callId").and_then(|v| v.as_str()).unwrap_or("");

    let message = if operation_id.is_empty() {
        format!("{} {}", ty, call_id)
    } else {
        let mut parts = vec![ty.to_string(), operation_id.to_string()];
        if !provider.is_empty() {
            parts.push(provider.to_string());
        }
        if !model.is_empty() {
            parts.push(model.to_string());
        }
        parts.join(" | ")
    };

    Some(LogLine {
        source: LogSource::AiConversations,
        timestamp: dt_utc.to_rfc3339(),
        timestamp_ms: dt_utc.timestamp_millis(),
        level,
        target: Some(ty.to_string()),
        message: truncate_message(message),
        raw: raw.to_string(),
    })
}

fn truncate_message(message: String) -> String {
    if message.len() > MESSAGE_PREVIEW_LEN {
        format!("{}...", &message[..MESSAGE_PREVIEW_LEN])
    } else {
        message
    }
}
