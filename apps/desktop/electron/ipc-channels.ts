export const IPC_CHANNELS = {
  // Settings
  GET_THEME: 'get_theme',
  SET_THEME: 'set_theme',
  THEME_CHANGED: 'theme-changed',

  GET_LANGUAGE: 'get_language',
  SET_LANGUAGE: 'set_language',
  LANGUAGE_CHANGED: 'language-changed',

  GET_AI_SETTINGS: 'get_ai_settings_command',
  SET_AI_SETTINGS: 'set_ai_settings_command',
  AI_SETTINGS_CHANGED: 'ai-settings-changed',

  // App paths
  GET_APP_PATHS: 'get_app_paths',
  OPEN_APP_FOLDER: 'open_app_folder',

  // Agent server
  AGENT_SERVER_START: 'agent_server_start',
  AGENT_SERVER_STOP: 'agent_server_stop',
  AGENT_SERVER_STATUS: 'agent_server_status',
  AGENT_SERVER_PORT: 'agent-server-port',
  AGENT_SERVER_STOPPED: 'agent-server-stopped',

  // Log viewer
  STREAM_LOG: 'stream_log',
  STOP_LOG_STREAM: 'stop_log_stream',
  EXPORT_LOG: 'export_log',
  LOG_EVENT: 'log:event',

  // Generic
  APP_GET_VERSION: 'app:get_version',
  APP_RELAUNCH: 'app:relaunch',
  NAVIGATE: 'app:navigate',
  OS_GET_TYPE: 'os:get_type',
  OS_GET_LOCALE: 'os:get_locale',
  PATH_GET_HOME_DIR: 'path:get_home_dir',
  WINDOW_GET_LABEL: 'window:get_label',
  WINDOW_GET_TRAFFIC_LIGHT_INSET: 'window:get-traffic-light-inset',
  RESOURCES_READ_LOCALE: 'resources:read_locale',

  // Clipboard / dialog
  CLIPBOARD_WRITE_TEXT: 'clipboard:write_text',
  DIALOG_SHOW_SAVE: 'dialog:show_save_dialog',
  DIALOG_SHOW_OPEN: 'dialog:show_open_dialog',
  DIALOG_SHOW_MESSAGE: 'dialog:show_message_box',

  // FS
  FS_READ_DIR: 'fs:read_dir',
  FS_STAT: 'fs:stat',
  FS_LSTAT: 'fs:lstat',
  FS_READ_TEXT_FILE: 'fs:read_text_file',
  FS_READ_FILE: 'fs:read_file',
  FS_WRITE_TEXT_FILE: 'fs:write_text_file',
  FS_WRITE_FILE: 'fs:write_file',
  FS_EXISTS: 'fs:exists',
  FS_MKDIR: 'fs:mkdir',
  FS_REMOVE: 'fs:remove',
  FS_COPY_FILE: 'fs:copy_file',
  FS_RENAME: 'fs:rename',
  FS_WATCH: 'fs:watch',
  FS_UNWATCH: 'fs:unwatch',
  FS_FILE_CHANGED: 'fs:file_changed',

  // Shell
  SHELL_OPEN_EXTERNAL: 'shell:open_external',
  SHELL_OPEN_PATH: 'shell:open_path',

  // DB
  DB_SELECT: 'db:select',
  DB_EXECUTE: 'db:execute',

  // Logger
  LOG: 'log:write',

  // Updater
  UPDATER_CHECK: 'updater:check',
  UPDATER_DOWNLOAD_INSTALL: 'updater:download_and_install',
  UPDATER_EVENT: 'updater:event',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
