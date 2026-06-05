// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThreeDAutoOrbitController } from '../src/interaction/three-d-mode';
import { createViewerState } from './helpers/state-fixtures';
import type { ViewerState } from '../src/types';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('3D auto-orbit controller', () => {
  it('advances depth yaw and pitch after the first frame', () => {
    const harness = createHarness({
      viewerMode: '3d',
      depthChannel: 'Z',
      depthYawDeg: 0,
      depthPitchDeg: 0
    });

    harness.controller.setConfig({
      autoOrbit: true,
      orbitSpeedDegPerSecond: 6,
      orbitYawAmplitudeDeg: 12,
      orbitPitchAmplitudeDeg: 2
    });

    expect(harness.hasScheduledFrame()).toBe(true);
    harness.flushFrame(1000);
    expect(harness.getState().depthYawDeg).toBe(0);
    expect(harness.getState().depthPitchDeg).toBe(0);

    harness.flushFrame(1100);
    expect(harness.getState().depthYawDeg).toBeLessThan(0);
    expect(Math.abs(harness.getState().depthYawDeg)).toBeLessThan(1);
    expect(Math.abs(harness.getState().depthPitchDeg)).toBeLessThan(0.1);
  });

  it('keeps scalar depth auto-orbit inside the front-safe cone without collapsing near edges', () => {
    const harness = createHarness({
      viewerMode: '3d',
      depthChannel: 'Z',
      depthYawDeg: 40,
      depthPitchDeg: 14
    });

    harness.controller.setConfig({
      autoOrbit: true,
      orbitSpeedDegPerSecond: 12,
      orbitYawAmplitudeDeg: 30,
      orbitPitchAmplitudeDeg: 8
    });
    for (let timestamp = 1000; timestamp <= 17000; timestamp += 50) {
      harness.flushFrame(timestamp);
    }

    for (const patch of harness.onViewChange.mock.calls.map((call) => call[0])) {
      if (patch.depthYawDeg !== undefined) {
        expect(Math.abs(patch.depthYawDeg)).toBeLessThanOrEqual(45);
      }
      if (patch.depthPitchDeg !== undefined) {
        expect(Math.abs(patch.depthPitchDeg)).toBeLessThanOrEqual(15);
      }
    }

    const yawValues = harness.onViewChange.mock.calls
      .map((call) => call[0].depthYawDeg)
      .filter((value): value is number => value !== undefined);
    expect(Math.max(...yawValues) - Math.min(...yawValues)).toBeGreaterThan(50);
  });

  it('brings XYZ position sources into the same front-biased orbit after ramping', () => {
    const harness = createHarness({
      viewerMode: '3d',
      depthChannel: '__position:P',
      depthYawDeg: 170,
      depthPitchDeg: 0
    });

    harness.controller.setConfig({
      autoOrbit: true,
      orbitSpeedDegPerSecond: 12,
      orbitYawAmplitudeDeg: 30,
      orbitPitchAmplitudeDeg: 0
    });
    for (let timestamp = 1000; timestamp <= 4000; timestamp += 50) {
      harness.flushFrame(timestamp);
    }

    expect(Math.abs(harness.getState().depthYawDeg)).toBeLessThanOrEqual(45);
  });

  it('uses the same configured yaw amount from different releases inside the safe cone', () => {
    const centeredRange = measureYawRange(0);
    const shiftedRange = measureYawRange(20);
    const centeredSpan = centeredRange.max - centeredRange.min;
    const shiftedSpan = shiftedRange.max - shiftedRange.min;

    expect(centeredSpan).toBeGreaterThan(23.8);
    expect(shiftedSpan).toBeGreaterThan(23.8);
    expect(Math.abs(centeredSpan - shiftedSpan)).toBeLessThan(0.2);
  });

  it('resumes yaw toward center from positive and negative releases', () => {
    const positiveHarness = createHarness({
      viewerMode: '3d',
      depthChannel: 'Z',
      depthYawDeg: 20,
      depthPitchDeg: 0
    }, {
      rampDurationMs: 0
    });
    positiveHarness.controller.setConfig({
      autoOrbit: true,
      orbitSpeedDegPerSecond: 12,
      orbitYawAmplitudeDeg: 12,
      orbitPitchAmplitudeDeg: 2
    });
    positiveHarness.flushFrame(1000);
    const positiveReleaseYaw = positiveHarness.getState().depthYawDeg;
    positiveHarness.flushFrame(1050);
    expect(positiveHarness.getState().depthYawDeg).toBeLessThan(positiveReleaseYaw);

    const negativeHarness = createHarness({
      viewerMode: '3d',
      depthChannel: 'Z',
      depthYawDeg: -20,
      depthPitchDeg: 0
    }, {
      rampDurationMs: 0
    });
    negativeHarness.controller.setConfig({
      autoOrbit: true,
      orbitSpeedDegPerSecond: 12,
      orbitYawAmplitudeDeg: 12,
      orbitPitchAmplitudeDeg: 2
    });
    negativeHarness.flushFrame(1000);
    const negativeReleaseYaw = negativeHarness.getState().depthYawDeg;
    negativeHarness.flushFrame(1050);
    expect(negativeHarness.getState().depthYawDeg).toBeGreaterThan(negativeReleaseYaw);
  });

  it('does not schedule without 3D eligibility', () => {
    for (const options of [
      { state: { viewerMode: 'image' as const, depthChannel: 'Z' }, imageSize: { width: 360, height: 240 } },
      { state: { viewerMode: '3d' as const, depthChannel: null }, imageSize: { width: 360, height: 240 } },
      { state: { viewerMode: '3d' as const, depthChannel: 'Z' }, imageSize: null },
      { state: { viewerMode: '3d' as const, depthChannel: 'Z' }, viewport: { width: 0, height: 100 } },
      { state: { viewerMode: '3d' as const, depthChannel: 'Z' }, visibilityState: 'hidden' as DocumentVisibilityState },
      { state: { viewerMode: '3d' as const, depthChannel: 'Z' }, prefersReducedMotion: true },
      { state: { viewerMode: '3d' as const, depthChannel: 'Z' }, speed: 0 },
      { state: { viewerMode: '3d' as const, depthChannel: 'Z' }, yaw: 0, pitch: 0 }
    ]) {
      const harness = createHarness(options.state, {
        imageSize: options.imageSize,
        viewport: options.viewport,
        visibilityState: options.visibilityState,
        prefersReducedMotion: options.prefersReducedMotion
      });

      harness.controller.setConfig({
        autoOrbit: true,
        orbitSpeedDegPerSecond: options.speed ?? 6,
        orbitYawAmplitudeDeg: options.yaw ?? 12,
        orbitPitchAmplitudeDeg: options.pitch ?? 2
      });

      expect(harness.hasScheduledFrame()).toBe(false);
      expect(harness.onViewChange).not.toHaveBeenCalled();
    }
  });

  it('pauses during user input and resumes immediately with a smooth ramp', () => {
    const harness = createHarness({
      viewerMode: '3d',
      depthChannel: 'Z',
      depthYawDeg: 0,
      depthPitchDeg: 0
    });

    harness.controller.setConfig({
      autoOrbit: true,
      orbitSpeedDegPerSecond: 6,
      orbitYawAmplitudeDeg: 12,
      orbitPitchAmplitudeDeg: 2
    });
    harness.flushFrame(1000);
    harness.flushFrame(1100);
    const beforePauseYaw = harness.getState().depthYawDeg;

    harness.controller.setUserInteracting(true);
    expect(harness.hasScheduledFrame()).toBe(false);
    harness.flushFrame(1200);
    expect(harness.getState().depthYawDeg).toBe(beforePauseYaw);

    harness.patchState({
      depthYawDeg: 20,
      depthPitchDeg: 5
    });
    harness.setNow(2500);
    harness.controller.setUserInteracting(false);
    expect(harness.hasScheduledFrame()).toBe(true);
    expect(harness.hasScheduledTimeout()).toBe(false);

    harness.flushFrame(2500);
    expect(harness.getState().depthYawDeg).toBe(20);

    harness.flushFrame(2550);
    const earlyResumeYaw = harness.getState().depthYawDeg;
    expect(earlyResumeYaw).toBeLessThan(20);
    expect(earlyResumeYaw).toBeGreaterThan(19.8);
    expect(Math.abs(earlyResumeYaw - beforePauseYaw)).toBeGreaterThan(10);
  });

  it('ramps phase speed from zero to the configured orbit speed after resume', () => {
    const harness = createHarness({
      viewerMode: '3d',
      depthChannel: 'Z',
      depthYawDeg: 0,
      depthPitchDeg: 0
    });

    harness.controller.setConfig({
      autoOrbit: true,
      orbitSpeedDegPerSecond: 8,
      orbitYawAmplitudeDeg: 0,
      orbitPitchAmplitudeDeg: 8
    });
    harness.flushFrame(1000);
    harness.controller.setUserInteracting(true);
    harness.setNow(2500);
    harness.controller.setUserInteracting(false);

    expect(harness.hasScheduledFrame()).toBe(true);
    expect(harness.hasScheduledTimeout()).toBe(false);

    harness.flushFrame(2500);
    harness.flushFrame(2550);
    const earlyPitch = harness.getState().depthPitchDeg;
    expect(earlyPitch).toBeLessThanOrEqual(0);
    expect(Math.abs(earlyPitch)).toBeLessThan(0.005);

    for (let timestamp = 2600; timestamp <= 3700; timestamp += 50) {
      harness.flushFrame(timestamp);
    }
    const beforeFullSpeedPitch = harness.getState().depthPitchDeg;
    harness.flushFrame(3750);
    const fullSpeedPitch = harness.getState().depthPitchDeg;
    const inferredPhase = Math.acos(Math.min(1, Math.max(-1, beforeFullSpeedPitch / 8)));
    const expectedFullSpeedPitch = Math.cos(inferredPhase + 0.05) * 8;

    expect(fullSpeedPitch).toBeCloseTo(expectedFullSpeedPitch, 5);
  });

  it('cancels pending frame and timeout on dispose', () => {
    const harness = createHarness({
      viewerMode: '3d',
      depthChannel: 'Z'
    }, {
      resumeDelayMs: 1200
    });

    harness.controller.setConfig({
      autoOrbit: true,
      orbitSpeedDegPerSecond: 6,
      orbitYawAmplitudeDeg: 12,
      orbitPitchAmplitudeDeg: 2
    });
    harness.controller.pauseForUserInteraction();
    harness.controller.destroy();

    expect(harness.cancelFrame).toHaveBeenCalled();
    expect(harness.cancelTimeout).toHaveBeenCalled();
    expect(harness.hasScheduledFrame()).toBe(false);
    expect(harness.hasScheduledTimeout()).toBe(false);
  });
});

function createHarness(
  stateOverrides: Parameters<typeof createViewerState>[0] = {},
  options: {
    imageSize?: { width: number; height: number } | null;
    viewport?: { width: number; height: number };
    visibilityState?: DocumentVisibilityState;
    prefersReducedMotion?: boolean;
    resumeDelayMs?: number;
    rampDurationMs?: number;
  } = {}
) {
  let state: ViewerState = createViewerState({
    viewerMode: '3d',
    depthChannel: 'Z',
    ...stateOverrides
  });
  let now = 0;
  let frameCallback: FrameRequestCallback | null = null;
  let timeoutCallback: (() => void) | null = null;
  let nextFrameId = 1;
  let nextTimeoutId = 1;
  const onViewChange = vi.fn((patch: Partial<ViewerState>) => {
    state = {
      ...state,
      ...patch
    };
  });
  const cancelFrame = vi.fn(() => {
    frameCallback = null;
  });
  const cancelTimeout = vi.fn(() => {
    timeoutCallback = null;
  });

  const controller = new ThreeDAutoOrbitController({
    getState: () => state,
    getViewport: () => options.viewport ?? { width: 360, height: 240 },
    getImageSize: () => options.imageSize === undefined ? { width: 360, height: 240 } : options.imageSize,
    onViewChange
  }, {
    scheduleFrame: (callback) => {
      frameCallback = callback;
      return nextFrameId++;
    },
    cancelFrame,
    scheduleTimeout: (callback) => {
      timeoutCallback = callback;
      return nextTimeoutId++;
    },
    cancelTimeout,
    now: () => now,
    getVisibilityState: () => options.visibilityState ?? 'visible',
    prefersReducedMotion: () => options.prefersReducedMotion === true,
    resumeDelayMs: options.resumeDelayMs,
    rampDurationMs: options.rampDurationMs
  });

  return {
    controller,
    onViewChange,
    cancelFrame,
    cancelTimeout,
    getState: () => state,
    patchState: (patch: Partial<ViewerState>) => {
      state = {
        ...state,
        ...patch
      };
    },
    setNow: (value: number) => {
      now = value;
    },
    flushFrame: (timestamp: number) => {
      const callback = frameCallback;
      frameCallback = null;
      callback?.(timestamp);
    },
    flushTimeout: () => {
      const callback = timeoutCallback;
      timeoutCallback = null;
      callback?.();
    },
    hasScheduledFrame: () => frameCallback !== null,
    hasScheduledTimeout: () => timeoutCallback !== null
  };
}

function measureYawRange(startYawDeg: number): { min: number; max: number } {
  const harness = createHarness({
    viewerMode: '3d',
    depthChannel: 'Z',
    depthYawDeg: startYawDeg,
    depthPitchDeg: 0
  }, {
    rampDurationMs: 0
  });
  harness.controller.setConfig({
    autoOrbit: true,
    orbitSpeedDegPerSecond: 12,
    orbitYawAmplitudeDeg: 12,
    orbitPitchAmplitudeDeg: 0
  });

  for (let timestamp = 1000; timestamp <= 8000; timestamp += 50) {
    harness.flushFrame(timestamp);
  }

  const yawValues = harness.onViewChange.mock.calls
    .map((call) => call[0].depthYawDeg)
    .filter((value): value is number => value !== undefined);
  return {
    min: Math.min(...yawValues),
    max: Math.max(...yawValues)
  };
}
