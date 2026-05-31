use serde::Serialize;
use std::io;
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DesktopErrorCode {
    NotFound,
    NotFile,
    NotExr,
    PermissionDenied,
    TooLarge,
    FolderLimit,
    InvalidOutput,
    #[allow(dead_code)]
    Cancelled,
    Io,
}

#[derive(Debug, Error, Serialize)]
#[error("{message}")]
pub struct DesktopError {
    pub code: DesktopErrorCode,
    pub message: String,
}

pub type DesktopResult<T> = Result<T, DesktopError>;

impl DesktopError {
    pub fn new(code: DesktopErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(DesktopErrorCode::NotFound, message)
    }

    pub fn not_file(message: impl Into<String>) -> Self {
        Self::new(DesktopErrorCode::NotFile, message)
    }

    pub fn not_exr(message: impl Into<String>) -> Self {
        Self::new(DesktopErrorCode::NotExr, message)
    }

    pub fn permission_denied(message: impl Into<String>) -> Self {
        Self::new(DesktopErrorCode::PermissionDenied, message)
    }

    pub fn too_large(message: impl Into<String>) -> Self {
        Self::new(DesktopErrorCode::TooLarge, message)
    }

    pub fn folder_limit(message: impl Into<String>) -> Self {
        Self::new(DesktopErrorCode::FolderLimit, message)
    }

    pub fn invalid_output(message: impl Into<String>) -> Self {
        Self::new(DesktopErrorCode::InvalidOutput, message)
    }

    #[allow(dead_code)]
    pub fn cancelled() -> Self {
        Self::new(DesktopErrorCode::Cancelled, "Dialog was cancelled.")
    }

    pub fn io(message: impl Into<String>) -> Self {
        Self::new(DesktopErrorCode::Io, message)
    }

    pub fn from_io(context: impl AsRef<str>, error: io::Error) -> Self {
        let message = format!("{}: {error}", context.as_ref());
        match error.kind() {
            io::ErrorKind::NotFound => Self::new(DesktopErrorCode::NotFound, message),
            io::ErrorKind::PermissionDenied => {
                Self::new(DesktopErrorCode::PermissionDenied, message)
            }
            _ => Self::new(DesktopErrorCode::Io, message),
        }
    }
}
