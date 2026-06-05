import { describe, expect, it } from 'vitest';
import { buildRoiReadoutModel } from '../src/app/roi-presentation';
import type { DecodedExrImage, OpenedImageSession } from '../src/types';
import {
  createChannelMonoSelection,
  createLayerFromChannels,
  createViewerSessionState
} from './helpers/state-fixtures';

describe('ROI presentation', () => {
  it('keeps committed ROI readout available across viewer modes', () => {
    const decoded: DecodedExrImage = {
      width: 2,
      height: 2,
      layers: [
        createLayerFromChannels({
          R: [1, 2, 3, 4]
        })
      ]
    };
    const activeSession = createSession(decoded);
    const activeLayer = decoded.layers[0]!;
    const roi = { x0: 0, y0: 0, x1: 1, y1: 0 };

    for (const viewerMode of ['image', 'panorama', '3d'] as const) {
      const readout = buildRoiReadoutModel({
        activeSession,
        activeLayer,
        sessionState: createViewerSessionState({
          viewerMode,
          roi,
          displaySelection: createChannelMonoSelection('R')
        })
      });

      expect(readout.roi).toEqual(roi);
      expect(readout.stats).toMatchObject({
        roi,
        width: 2,
        height: 1,
        pixelCount: 2,
        channels: [
          {
            label: 'Mono',
            min: 1,
            mean: 1.5,
            max: 2,
            validPixelCount: 2
          }
        ]
      });
    }
  });
});

function createSession(decoded: DecodedExrImage): OpenedImageSession {
  return {
    id: 'session-1',
    filename: 'session-1.exr',
    displayName: 'session-1.exr',
    fileSizeBytes: 16,
    source: { kind: 'url', url: '/session-1.exr' },
    decoded,
    state: createViewerSessionState()
  };
}
