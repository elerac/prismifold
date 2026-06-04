// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  INVALID_VALUE_WARNING_STORAGE_KEY,
  normalizeInvalidValueWarningSetting,
  readStoredInvalidValueWarningSetting,
  saveStoredInvalidValueWarningSetting
} from '../src/invalid-value-warning-settings';

describe('invalid value warning settings', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('normalizes only booleans and defaults to disabled', () => {
    expect(normalizeInvalidValueWarningSetting(false)).toBe(false);
    expect(normalizeInvalidValueWarningSetting(true)).toBe(true);
    expect(normalizeInvalidValueWarningSetting('false')).toBe(false);
    expect(normalizeInvalidValueWarningSetting(null)).toBe(false);
  });

  it('persists enabled and clears storage for the default disabled value', () => {
    saveStoredInvalidValueWarningSetting(true);

    expect(window.localStorage.getItem(INVALID_VALUE_WARNING_STORAGE_KEY)).toBe('true');
    expect(readStoredInvalidValueWarningSetting()).toBe(true);

    saveStoredInvalidValueWarningSetting(false);

    expect(window.localStorage.getItem(INVALID_VALUE_WARNING_STORAGE_KEY)).toBeNull();
    expect(readStoredInvalidValueWarningSetting()).toBe(false);
  });
});
