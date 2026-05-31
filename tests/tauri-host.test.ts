// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock, menuNewMock, predefinedMenuItemNewMock, setAsAppMenuMock, submenuNewMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  menuNewMock: vi.fn(),
  predefinedMenuItemNewMock: vi.fn(),
  setAsAppMenuMock: vi.fn(),
  submenuNewMock: vi.fn()
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock
}));

vi.mock('@tauri-apps/api/menu', () => ({
  Menu: {
    new: menuNewMock
  },
  PredefinedMenuItem: {
    new: predefinedMenuItemNewMock
  },
  Submenu: {
    new: submenuNewMock
  }
}));

import { tauriHost } from '../src/platform/tauri-host';

beforeEach(() => {
  invokeMock.mockReset();
  menuNewMock.mockReset();
  predefinedMenuItemNewMock.mockReset();
  setAsAppMenuMock.mockReset();
  submenuNewMock.mockReset();

  menuNewMock.mockImplementation(async (options) => ({
    ...options,
    setAsAppMenu: setAsAppMenuMock
  }));
  predefinedMenuItemNewMock.mockImplementation(async (options) => ({ kind: 'predefined', ...options }));
  submenuNewMock.mockImplementation(async (options) => ({ kind: 'submenu', ...options }));
});

describe('tauri host', () => {
  it('returns typed save cancellation and sends raw bytes', async () => {
    invokeMock.mockResolvedValueOnce({ status: 'cancelled' });

    const result = await tauriHost.saveBlob(new Blob([new Uint8Array([1, 2, 3])]), {
      filename: 'beauty.png',
      title: 'Export Image',
      extensions: ['png']
    });

    expect(result).toEqual({ status: 'cancelled' });
    expect(invokeMock).toHaveBeenCalledWith('save_export_file', {
      filename: 'beauty.png',
      title: 'Export Image',
      extensions: ['png'],
      bytes: expect.any(Uint8Array)
    });
  });

  it('normalizes grant-backed path entries and reads by grant id', async () => {
    invokeMock
      .mockResolvedValueOnce([
        {
          grantId: 'grant-1',
          path: '/renders/beauty.exr',
          filename: 'beauty.exr',
          displayPath: '/renders/beauty.exr',
          fileSizeBytes: 3
        }
      ])
      .mockResolvedValueOnce(new Uint8Array([4, 5, 6]));

    const entries = await tauriHost.pathFileProvider!.resolveExrPaths(['/renders/beauty.exr']);
    const bytes = await tauriHost.pathFileProvider!.readExrFile(entries[0]!.grantId);

    expect(entries).toEqual([
      {
        grantId: 'grant-1',
        path: '/renders/beauty.exr',
        filename: 'beauty.exr',
        displayPath: '/renders/beauty.exr',
        fileSizeBytes: 3
      }
    ]);
    expect(bytes.bytes).toEqual(new Uint8Array([4, 5, 6]));
    expect(invokeMock).toHaveBeenNthCalledWith(1, 'resolve_exr_paths', { paths: ['/renders/beauty.exr'] });
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'read_exr_file', { grantId: 'grant-1' });
  });

  it('uses Rust-owned recent files and records successful grant loads', async () => {
    const recentChanged = vi.fn();
    window.addEventListener('openexr-viewer:desktop-recent-files-changed', recentChanged);
    invokeMock
      .mockResolvedValueOnce([
        {
          path: '/renders/beauty.exr',
          label: 'beauty.exr',
          displayPath: '/renders/beauty.exr',
          openedAt: 123
        }
      ])
      .mockResolvedValueOnce([]);

    try {
      await expect(tauriHost.refreshRecentFiles()).resolves.toEqual([
        {
          path: '/renders/beauty.exr',
          label: 'beauty.exr',
          displayPath: '/renders/beauty.exr',
          openedAt: 123
        }
      ]);

      tauriHost.recordRecentFile({
        grantId: 'grant-1',
        path: '/renders/beauty.exr',
        filename: 'beauty.exr',
        displayPath: '/renders/beauty.exr',
        fileSizeBytes: 3
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(invokeMock).toHaveBeenNthCalledWith(2, 'record_recent_file', { grantId: 'grant-1' });
      expect(recentChanged).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('openexr-viewer:desktop-recent-files-changed', recentChanged);
    }
  });

  it('routes native menu commands through desktop command callbacks', async () => {
    invokeMock.mockResolvedValueOnce([]);
    const onCommand = vi.fn();

    await tauriHost.setupDesktopCommands({
      onCommand,
      onOpenRecent: vi.fn()
    });

    const fileMenuOptions = submenuNewMock.mock.calls
      .map((call) => call[0])
      .find((options) => options.text === 'File');
    const openItem = fileMenuOptions.items.find((item: { text?: string }) => item.text === 'Open...');
    openItem.action();

    expect(onCommand).toHaveBeenCalledWith('openFile');
    expect(setAsAppMenuMock).toHaveBeenCalledTimes(1);
  });
});
