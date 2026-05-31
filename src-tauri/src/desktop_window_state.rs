use crate::desktop_error::{DesktopError, DesktopResult};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, Position, Size, WebviewWindow, Window,
    WindowEvent,
};

const WINDOW_STATE_FILENAME: &str = "window-state.json";
const MAIN_WINDOW_LABEL: &str = "main";
const MIN_WINDOW_WIDTH: u32 = 900;
const MIN_WINDOW_HEIGHT: u32 = 640;
const SAVE_THROTTLE: Duration = Duration::from_millis(750);

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StoredWindowState {
    pub width: u32,
    pub height: u32,
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub maximized: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RestoredWindowState {
    pub width: u32,
    pub height: u32,
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub maximized: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MonitorBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Default)]
pub struct DesktopWindowStateTracker {
    last_save: Mutex<Option<Instant>>,
}

impl DesktopWindowStateTracker {
    pub fn record_window_event(&self, window: &Window, event: &WindowEvent) {
        match event {
            WindowEvent::Resized(_)
            | WindowEvent::Moved(_)
            | WindowEvent::ScaleFactorChanged { .. } => self.save_throttled(window),
            WindowEvent::Focused(false) | WindowEvent::CloseRequested { .. } => {
                let _ = save_window_state(window);
            }
            _ => {}
        }
    }

    fn save_throttled(&self, window: &Window) {
        let Ok(mut last_save) = self.last_save.lock() else {
            return;
        };
        let now = Instant::now();
        if last_save.is_some_and(|previous| now.duration_since(previous) < SAVE_THROTTLE) {
            return;
        }
        *last_save = Some(now);
        let _ = save_window_state(window);
    }
}

pub fn restore_main_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };
    let Ok(Some(stored_state)) = load_window_state(app) else {
        return;
    };
    let Some(state) = sanitize_window_state(stored_state, &monitor_bounds(&window)) else {
        return;
    };

    let _ = window.set_size(Size::Physical(PhysicalSize {
        width: state.width,
        height: state.height,
    }));
    if let (Some(x), Some(y)) = (state.x, state.y) {
        let _ = window.set_position(Position::Physical(PhysicalPosition { x, y }));
    }
    if state.maximized {
        let _ = window.maximize();
    }
}

pub fn save_main_window_state(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = save_webview_window_state(&window);
    }
}

pub fn is_main_window(label: &str) -> bool {
    label == MAIN_WINDOW_LABEL
}

pub fn sanitize_window_state(
    state: StoredWindowState,
    monitors: &[MonitorBounds],
) -> Option<RestoredWindowState> {
    if state.width == 0 || state.height == 0 {
        return None;
    }

    let width = state.width.max(MIN_WINDOW_WIDTH);
    let height = state.height.max(MIN_WINDOW_HEIGHT);
    let position = match (state.x, state.y) {
        (Some(x), Some(y)) if is_window_visible_on_any_monitor(x, y, width, height, monitors) => {
            (Some(x), Some(y))
        }
        _ => (None, None),
    };

    Some(RestoredWindowState {
        width,
        height,
        x: position.0,
        y: position.1,
        maximized: state.maximized,
    })
}

fn save_window_state(window: &Window) -> DesktopResult<()> {
    if window.is_fullscreen().unwrap_or(false) {
        return Ok(());
    }
    let state = read_current_window_state(window)?;
    save_window_state_to_path(&window_state_path(window.app_handle())?, &state)
}

fn save_webview_window_state(window: &WebviewWindow) -> DesktopResult<()> {
    if window.is_fullscreen().unwrap_or(false) {
        return Ok(());
    }
    let size = window
        .inner_size()
        .map_err(|error| DesktopError::io(format!("Failed to read window size: {error}")))?;
    let position = window.outer_position().ok();
    let maximized = window.is_maximized().unwrap_or(false);
    let state = StoredWindowState {
        width: size.width.max(MIN_WINDOW_WIDTH),
        height: size.height.max(MIN_WINDOW_HEIGHT),
        x: position.map(|position| position.x),
        y: position.map(|position| position.y),
        maximized,
    };
    save_window_state_to_path(&window_state_path(window.app_handle())?, &state)
}

fn read_current_window_state(window: &Window) -> DesktopResult<StoredWindowState> {
    let size = window
        .inner_size()
        .map_err(|error| DesktopError::io(format!("Failed to read window size: {error}")))?;
    let position = window.outer_position().ok();
    let maximized = window.is_maximized().unwrap_or(false);

    Ok(StoredWindowState {
        width: size.width.max(MIN_WINDOW_WIDTH),
        height: size.height.max(MIN_WINDOW_HEIGHT),
        x: position.map(|position| position.x),
        y: position.map(|position| position.y),
        maximized,
    })
}

fn load_window_state(app: &AppHandle) -> DesktopResult<Option<StoredWindowState>> {
    load_window_state_from_path(&window_state_path(app)?)
}

fn load_window_state_from_path(path: &Path) -> DesktopResult<Option<StoredWindowState>> {
    if !path.exists() {
        return Ok(None);
    }
    let bytes = fs::read(path)
        .map_err(|error| DesktopError::from_io("Failed to read desktop window state", error))?;
    Ok(serde_json::from_slice::<StoredWindowState>(&bytes).ok())
}

fn save_window_state_to_path(path: &Path, state: &StoredWindowState) -> DesktopResult<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            DesktopError::from_io("Failed to create desktop window state folder", error)
        })?;
    }
    let bytes = serde_json::to_vec_pretty(state).map_err(|error| {
        DesktopError::io(format!("Failed to serialize desktop window state: {error}"))
    })?;
    fs::write(path, bytes)
        .map_err(|error| DesktopError::from_io("Failed to save desktop window state", error))
}

fn window_state_path(app: &AppHandle) -> DesktopResult<PathBuf> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(WINDOW_STATE_FILENAME))
        .map_err(|error| DesktopError::io(format!("Failed to resolve app data folder: {error}")))
}

fn monitor_bounds(window: &WebviewWindow) -> Vec<MonitorBounds> {
    window
        .available_monitors()
        .unwrap_or_default()
        .into_iter()
        .map(|monitor| {
            let area = monitor.work_area();
            MonitorBounds {
                x: area.position.x,
                y: area.position.y,
                width: area.size.width,
                height: area.size.height,
            }
        })
        .collect()
}

fn is_window_visible_on_any_monitor(
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    monitors: &[MonitorBounds],
) -> bool {
    if monitors.is_empty() {
        return false;
    }
    let right = x.saturating_add(width.min(i32::MAX as u32) as i32);
    let bottom = y.saturating_add(height.min(i32::MAX as u32) as i32);
    monitors.iter().any(|monitor| {
        let monitor_right = monitor
            .x
            .saturating_add(monitor.width.min(i32::MAX as u32) as i32);
        let monitor_bottom = monitor
            .y
            .saturating_add(monitor.height.min(i32::MAX as u32) as i32);
        right > monitor.x && x < monitor_right && bottom > monitor.y && y < monitor_bottom
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn monitor() -> MonitorBounds {
        MonitorBounds {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        }
    }

    #[test]
    fn restore_state_enforces_minimum_size() {
        let state = StoredWindowState {
            width: 320,
            height: 240,
            x: Some(10),
            y: Some(20),
            maximized: false,
        };

        assert_eq!(
            sanitize_window_state(state, &[monitor()]),
            Some(RestoredWindowState {
                width: MIN_WINDOW_WIDTH,
                height: MIN_WINDOW_HEIGHT,
                x: Some(10),
                y: Some(20),
                maximized: false,
            })
        );
    }

    #[test]
    fn restore_state_skips_offscreen_position() {
        let state = StoredWindowState {
            width: 1200,
            height: 800,
            x: Some(5000),
            y: Some(5000),
            maximized: true,
        };

        assert_eq!(
            sanitize_window_state(state, &[monitor()]),
            Some(RestoredWindowState {
                width: 1200,
                height: 800,
                x: None,
                y: None,
                maximized: true,
            })
        );
    }

    #[test]
    fn restore_state_rejects_empty_size() {
        let state = StoredWindowState {
            width: 0,
            height: 800,
            x: Some(10),
            y: Some(20),
            maximized: false,
        };

        assert_eq!(sanitize_window_state(state, &[monitor()]), None);
    }

    #[test]
    fn window_state_storage_ignores_invalid_json() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(WINDOW_STATE_FILENAME);
        fs::write(&path, b"{not-json").unwrap();

        assert_eq!(load_window_state_from_path(&path).unwrap(), None);
    }

    #[test]
    fn window_state_storage_round_trips() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(WINDOW_STATE_FILENAME);
        let state = StoredWindowState {
            width: 1440,
            height: 960,
            x: Some(30),
            y: Some(40),
            maximized: true,
        };

        save_window_state_to_path(&path, &state).unwrap();

        assert_eq!(load_window_state_from_path(&path).unwrap(), Some(state));
    }
}
