// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  IMAGE_LOAD_WORKERS_STORAGE_KEY,
  SYSTEM_MAX_IMAGE_LOAD_WORKERS_FALLBACK,
  getDefaultImageLoadWorkers,
  getSystemMaxImageLoadWorkers,
  normalizeImageLoadWorkers,
  readStoredImageLoadWorkers,
  saveStoredImageLoadWorkers
} from '../src/image-load-workers';

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('image load worker settings', () => {
  it('normalizes worker counts against the system maximum', () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 4 });

    expect(getSystemMaxImageLoadWorkers()).toBe(4);
    expect(getDefaultImageLoadWorkers()).toBe(4);
    expect(normalizeImageLoadWorkers(null)).toBe(4);
    expect(normalizeImageLoadWorkers('')).toBe(4);
    expect(normalizeImageLoadWorkers('bad')).toBe(4);
    expect(normalizeImageLoadWorkers(0)).toBe(1);
    expect(normalizeImageLoadWorkers(2.6)).toBe(3);
    expect(normalizeImageLoadWorkers(99)).toBe(4);
  });

  it('uses the default worker count as the system fallback', () => {
    vi.stubGlobal('navigator', {});

    expect(getSystemMaxImageLoadWorkers()).toBe(SYSTEM_MAX_IMAGE_LOAD_WORKERS_FALLBACK);
    expect(getDefaultImageLoadWorkers()).toBe(SYSTEM_MAX_IMAGE_LOAD_WORKERS_FALLBACK);
    expect(normalizeImageLoadWorkers(99)).toBe(SYSTEM_MAX_IMAGE_LOAD_WORKERS_FALLBACK);
  });

  it('reads and writes stored worker counts while clearing default overrides', () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 8 });

    expect(readStoredImageLoadWorkers()).toBe(8);

    saveStoredImageLoadWorkers(4);
    expect(window.localStorage.getItem(IMAGE_LOAD_WORKERS_STORAGE_KEY)).toBe('4');
    expect(readStoredImageLoadWorkers()).toBe(4);

    window.localStorage.setItem(IMAGE_LOAD_WORKERS_STORAGE_KEY, '99');
    expect(readStoredImageLoadWorkers()).toBe(8);

    saveStoredImageLoadWorkers(8);
    expect(window.localStorage.getItem(IMAGE_LOAD_WORKERS_STORAGE_KEY)).toBeNull();
  });
});
