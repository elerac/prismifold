// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_VIEWER_BACKGROUND_ID,
  VIEWER_BACKGROUND_STORAGE_KEY,
  getViewerBackgroundColor,
  parseStoredViewerBackground,
  readStoredViewerBackground,
  saveStoredViewerBackground
} from '../src/viewer-background-settings';

afterEach(() => {
  window.localStorage.clear();
});

describe('viewer background settings', () => {
  it('parses only supported stored background ids', () => {
    expect(parseStoredViewerBackground('white')).toBe('white');
    expect(parseStoredViewerBackground('black')).toBe('black');
    expect(parseStoredViewerBackground('gray')).toBe('gray');
    expect(parseStoredViewerBackground('checker')).toBe(DEFAULT_VIEWER_BACKGROUND_ID);
    expect(parseStoredViewerBackground('invalid')).toBe(DEFAULT_VIEWER_BACKGROUND_ID);
    expect(parseStoredViewerBackground(null)).toBe(DEFAULT_VIEWER_BACKGROUND_ID);
  });

  it('reads, saves, and clears the default persisted background', () => {
    expect(readStoredViewerBackground()).toBe(DEFAULT_VIEWER_BACKGROUND_ID);

    saveStoredViewerBackground('gray');
    expect(window.localStorage.getItem(VIEWER_BACKGROUND_STORAGE_KEY)).toBe('gray');
    expect(readStoredViewerBackground()).toBe('gray');

    saveStoredViewerBackground(DEFAULT_VIEWER_BACKGROUND_ID);
    expect(window.localStorage.getItem(VIEWER_BACKGROUND_STORAGE_KEY)).toBeNull();
    expect(readStoredViewerBackground()).toBe(DEFAULT_VIEWER_BACKGROUND_ID);
  });

  it('exposes solid background RGB values for the renderer', () => {
    expect(getViewerBackgroundColor('white')).toEqual([1, 1, 1]);
    expect(getViewerBackgroundColor('black')).toEqual([0, 0, 0]);
    expect(getViewerBackgroundColor('gray')).toEqual([0.5, 0.5, 0.5]);
    expect(getViewerBackgroundColor('checker')).toEqual([0, 0, 0]);
  });
});
