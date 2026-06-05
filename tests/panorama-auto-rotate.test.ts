// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { PanoramaAutoRotateController } from '../src/interaction/panorama-mode';
import { createViewerState } from './helpers/state-fixtures';
import type { ViewerState } from '../src/types';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('panorama auto-rotation controller', () => {
  it('advances yaw after the first frame and caps large frame deltas', () => {
    const harness = createHarness({
      viewerMode: 'panorama',
      panoramaYawDeg: 0
    });

    harness.controller.setConfig({
      autoRotate: true,
      rotationSpeedDegPerSecond: 10
    });

    expect(harness.hasScheduledFrame()).toBe(true);
    harness.flushFrame(1000);
    expect(harness.getState().panoramaYawDeg).toBe(0);

    harness.flushFrame(1020);
    expect(harness.getState().panoramaYawDeg).toBeCloseTo(0.2);

    harness.flushFrame(1220);
    expect(harness.getState().panoramaYawDeg).toBeCloseTo(0.7);
  });

  it('normalizes yaw while wrapping across the signed panorama range', () => {
    const harness = createHarness({
      viewerMode: 'panorama',
      panoramaYawDeg: 179.9
    });

    harness.controller.setConfig({
      autoRotate: true,
      rotationSpeedDegPerSecond: 10
    });
    harness.flushFrame(0);
    harness.flushFrame(50);

    expect(harness.getState().panoramaYawDeg).toBeCloseTo(-179.6);
  });

  it('does not schedule without panorama eligibility', () => {
    for (const options of [
      { state: { viewerMode: 'image' as const }, imageSize: { width: 360, height: 180 } },
      { state: { viewerMode: 'panorama' as const }, imageSize: null },
      { state: { viewerMode: 'panorama' as const }, visibilityState: 'hidden' as DocumentVisibilityState },
      { state: { viewerMode: 'panorama' as const }, prefersReducedMotion: true },
      { state: { viewerMode: 'panorama' as const }, speed: 0 }
    ]) {
      const harness = createHarness(options.state, {
        imageSize: options.imageSize,
        visibilityState: options.visibilityState,
        prefersReducedMotion: options.prefersReducedMotion
      });

      harness.controller.setConfig({
        autoRotate: true,
        rotationSpeedDegPerSecond: options.speed ?? 6
      });

      expect(harness.hasScheduledFrame()).toBe(false);
      expect(harness.onViewChange).not.toHaveBeenCalled();
    }
  });

  it('pauses during user input and resumes immediately with a smooth ramp', () => {
    const harness = createHarness({
      viewerMode: 'panorama',
      panoramaYawDeg: 0
    });

    harness.controller.setConfig({
      autoRotate: true,
      rotationSpeedDegPerSecond: 10
    });
    harness.flushFrame(1000);

    harness.controller.setUserInteracting(true);
    expect(harness.hasScheduledFrame()).toBe(false);

    harness.setNow(1500);
    harness.controller.setUserInteracting(false);
    expect(harness.hasScheduledFrame()).toBe(true);

    harness.flushFrame(1500);
    expect(harness.getState().panoramaYawDeg).toBe(0);

    harness.flushFrame(1550);
    const earlyRampYaw = harness.getState().panoramaYawDeg;
    expect(earlyRampYaw).toBeGreaterThan(0);
    expect(earlyRampYaw).toBeLessThan(0.1);

    harness.flushFrame(2700);
    expect(harness.getState().panoramaYawDeg).toBeCloseTo(earlyRampYaw + 0.5);

    harness.flushFrame(2750);
    expect(harness.getState().panoramaYawDeg).toBeCloseTo(earlyRampYaw + 1);
  });

  it('ramps negative speed by absolute speed while preserving direction', () => {
    const harness = createHarness({
      viewerMode: 'panorama',
      panoramaYawDeg: 0
    });

    harness.controller.setConfig({
      autoRotate: true,
      rotationSpeedDegPerSecond: -10
    });
    harness.flushFrame(1000);

    harness.controller.setUserInteracting(true);
    harness.setNow(1200);
    harness.controller.setUserInteracting(false);
    harness.flushFrame(1200);
    harness.flushFrame(1250);

    const earlyRampYaw = harness.getState().panoramaYawDeg;
    expect(earlyRampYaw).toBeLessThan(0);
    expect(Math.abs(earlyRampYaw)).toBeLessThan(0.1);

    harness.flushFrame(2400);
    expect(harness.getState().panoramaYawDeg).toBeCloseTo(earlyRampYaw - 0.5);
  });

  it('resets the ramp on repeated user input', () => {
    const harness = createHarness({
      viewerMode: 'panorama',
      panoramaYawDeg: 0
    });

    harness.controller.setConfig({
      autoRotate: true,
      rotationSpeedDegPerSecond: 10
    });
    harness.flushFrame(1000);

    harness.setNow(1000);
    harness.controller.pauseForUserInteraction();
    harness.flushFrame(1000);
    harness.flushFrame(1600);
    const firstRampYaw = harness.getState().panoramaYawDeg;
    expect(firstRampYaw).toBeGreaterThan(0.2);

    harness.setNow(1600);
    harness.controller.pauseForUserInteraction();
    harness.flushFrame(1600);
    harness.flushFrame(1650);

    expect(harness.getState().panoramaYawDeg - firstRampYaw).toBeLessThan(0.1);
  });

  it('cancels pending frame on dispose', () => {
    const harness = createHarness({
      viewerMode: 'panorama'
    });

    harness.controller.setConfig({
      autoRotate: true,
      rotationSpeedDegPerSecond: 6
    });
    harness.controller.pauseForUserInteraction();
    harness.controller.destroy();

    expect(harness.cancelFrame).toHaveBeenCalled();
    expect(harness.hasScheduledFrame()).toBe(false);
  });
});

function createHarness(
  stateOverrides: Parameters<typeof createViewerState>[0] = {},
  options: {
    imageSize?: { width: number; height: number } | null;
    visibilityState?: DocumentVisibilityState;
    prefersReducedMotion?: boolean;
  } = {}
) {
  let state: ViewerState = createViewerState({
    viewerMode: 'panorama',
    ...stateOverrides
  });
  let now = 0;
  let frameCallback: FrameRequestCallback | null = null;
  let nextFrameId = 1;
  const onViewChange = vi.fn((patch: Partial<ViewerState>) => {
    state = {
      ...state,
      ...patch
    };
  });
  const cancelFrame = vi.fn(() => {
    frameCallback = null;
  });

  const controller = new PanoramaAutoRotateController({
    getState: () => state,
    getImageSize: () => options.imageSize === undefined ? { width: 360, height: 180 } : options.imageSize,
    onViewChange
  }, {
    scheduleFrame: (callback) => {
      frameCallback = callback;
      return nextFrameId++;
    },
    cancelFrame,
    now: () => now,
    getVisibilityState: () => options.visibilityState ?? 'visible',
    prefersReducedMotion: () => options.prefersReducedMotion === true
  });

  return {
    controller,
    onViewChange,
    cancelFrame,
    getState: () => state,
    setNow: (value: number) => {
      now = value;
    },
    flushFrame: (timestamp: number) => {
      const callback = frameCallback;
      frameCallback = null;
      callback?.(timestamp);
    },
    hasScheduledFrame: () => frameCallback !== null
  };
}
