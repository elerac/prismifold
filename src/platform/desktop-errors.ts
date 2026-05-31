import type { DesktopCommandError, DesktopErrorCode } from './types';

const DESKTOP_ERROR_CODES: ReadonlySet<string> = new Set([
  'notFound',
  'notFile',
  'notExr',
  'permissionDenied',
  'tooLarge',
  'folderLimit',
  'invalidOutput',
  'cancelled',
  'io'
]);

function normalizeCode(code: unknown): DesktopErrorCode | undefined {
  return typeof code === 'string' && DESKTOP_ERROR_CODES.has(code)
    ? code as DesktopErrorCode
    : undefined;
}

export function normalizeDesktopError(error: unknown, fallbackMessage = 'Desktop command failed.'): DesktopCommandError {
  if (error instanceof Error) {
    const desktopError = error as DesktopCommandError;
    desktopError.code = normalizeCode(desktopError.code);
    return desktopError;
  }

  if (error && typeof error === 'object') {
    const candidate = error as { message?: unknown; code?: unknown };
    const message = typeof candidate.message === 'string' && candidate.message.trim()
      ? candidate.message
      : fallbackMessage;
    const wrapped = new Error(message) as DesktopCommandError;
    wrapped.code = normalizeCode(candidate.code);
    return wrapped;
  }

  return new Error(typeof error === 'string' && error.trim() ? error : fallbackMessage) as DesktopCommandError;
}

export function isStaleDesktopPathError(error: unknown): boolean {
  const desktopError = normalizeDesktopError(error);
  if (desktopError.code === 'notFound' || desktopError.code === 'notFile') {
    return true;
  }
  return /does not exist|not a file/i.test(desktopError.message);
}

export interface DesktopErrorPresentation {
  message: string;
  detail: string;
  code?: DesktopErrorCode;
}

export function presentDesktopError(error: unknown, fallbackMessage = 'Desktop command failed.'): DesktopErrorPresentation {
  const desktopError = normalizeDesktopError(error, fallbackMessage);
  return {
    message: desktopError.code ? messageForDesktopErrorCode(desktopError.code, fallbackMessage) : desktopError.message,
    detail: desktopError.message,
    ...(desktopError.code ? { code: desktopError.code } : {})
  };
}

function messageForDesktopErrorCode(code: DesktopErrorCode, fallbackMessage: string): string {
  switch (code) {
    case 'notFound':
      return 'File was not found.';
    case 'notFile':
      return 'Path is not a file.';
    case 'notExr':
      return 'Choose an OpenEXR .exr file.';
    case 'permissionDenied':
      return 'Permission denied while accessing the file.';
    case 'tooLarge':
      return 'EXR file is too large.';
    case 'folderLimit':
      return 'Folder contains too many or too-large EXR files.';
    case 'invalidOutput':
      return 'Choose a valid .png or .zip export path.';
    case 'cancelled':
      return '';
    case 'io':
      return 'Desktop file operation failed.';
    default:
      return fallbackMessage;
  }
}
