import type {
  DesktopCommandCallbacks,
  DesktopEventCallbacks,
  DesktopFileEntry,
  DesktopRecentFile,
  ExportFileSaveOptions,
  ExportSaveResult,
  HostOpenFileOptions,
  HostOpenFolderOptions,
  RecentFileCallbacks,
  ViewerHost
} from './types';

const webAppFullscreenHost = {
  isSupported(): boolean {
    return typeof document.documentElement.requestFullscreen === 'function' &&
      typeof document.exitFullscreen === 'function';
  },
  isActive(): boolean {
    return document.fullscreenElement !== null;
  },
  async setActive(active: boolean): Promise<void> {
    if (active) {
      await document.documentElement.requestFullscreen();
      return;
    }
    if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      await document.exitFullscreen();
    }
  },
  async onChange(callback: () => void) {
    document.addEventListener('fullscreenchange', callback);
    document.addEventListener('fullscreenerror', callback);
    return {
      dispose: () => {
        document.removeEventListener('fullscreenchange', callback);
        document.removeEventListener('fullscreenerror', callback);
      }
    };
  }
};

export const webHost: ViewerHost = {
  kind: 'web',
  pathFileProvider: null,
  appFullscreen: webAppFullscreenHost,
  openFiles({ fallback }: HostOpenFileOptions): void {
    fallback();
  },
  openFolder({ fallback }: HostOpenFolderOptions): void {
    fallback();
  },
  async saveBlob(blob: Blob, options: ExportFileSaveOptions): Promise<ExportSaveResult> {
    triggerBrowserDownload(blob, options.filename);
    return { status: 'saved' };
  },
  validateCopyPngBlob(): void {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      throw new Error('Copying images to the clipboard is not supported by this browser.');
    }
    if (typeof ClipboardItem.supports === 'function' && !ClipboardItem.supports('image/png')) {
      throw new Error('Copying PNG images to the clipboard is not supported by this browser.');
    }
  },
  async copyPngBlob(blob: Blob): Promise<void> {
    this.validateCopyPngBlob?.();

    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob
      })
    ]);
  },
  async setupDesktopEvents(_callbacks: DesktopEventCallbacks) {
    return { dispose: () => {} };
  },
  async setupDesktopCommands(_callbacks: DesktopCommandCallbacks) {
    return { dispose: () => {} };
  },
  installRecentFilesMenu(_callbacks: RecentFileCallbacks) {
    return { dispose: () => {} };
  },
  async refreshRecentFiles(): Promise<DesktopRecentFile[]> {
    return [];
  },
  async clearRecentFiles(): Promise<void> {},
  recordRecentFile(_entry: DesktopFileEntry): void {},
  recordPathLoadFailure(_entry: DesktopFileEntry, _error: unknown): void {}
};

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}
