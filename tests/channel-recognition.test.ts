import { describe, expect, it } from 'vitest';
import {
  pickDefaultRecognizedCandidate,
  recognizeLayerChannels,
  type ChannelRecognitionConfig,
  type RecognizedChannelCandidate
} from '../src/channel-recognition';
import { serializeDisplaySelectionKey } from '../src/display-model';
import { MUELLER_MATRIX_ELEMENTS } from '../src/mueller';

function visibleCandidates(
  channelNames: string[],
  split = false,
  config: ChannelRecognitionConfig = {}
): RecognizedChannelCandidate[] {
  return recognizeLayerChannels(channelNames, config).candidates
    .filter((candidate) => split ? candidate.availability.split : candidate.availability.merged)
    .filter((candidate) => split || !candidate.metadata.hiddenInMergedChannelView)
    .sort((a, b) => a.sourceOrder - b.sourceOrder);
}

function visibleKeys(
  channelNames: string[],
  split = false,
  config: ChannelRecognitionConfig = {}
): string[] {
  return visibleCandidates(channelNames, split, config).map((candidate) => candidate.key);
}

function findCandidate(
  channelNames: string[],
  key: string,
  config: ChannelRecognitionConfig = {}
): RecognizedChannelCandidate | null {
  return recognizeLayerChannels(channelNames, config).candidates.find((candidate) => candidate.key === key) ?? null;
}

function selectionKey(candidate: RecognizedChannelCandidate | null): string | null {
  return candidate ? serializeDisplaySelectionKey(candidate.selection) : null;
}

function defaultSelectionKey(channelNames: string[], config: ChannelRecognitionConfig = {}): string | null {
  const candidate = pickDefaultRecognizedCandidate(recognizeLayerChannels(channelNames, config));
  return candidate ? serializeDisplaySelectionKey(candidate.selection) : null;
}

describe('channel recognition', () => {
  it('recognizes RGB/RGBA groups and split children without changing option identity', () => {
    const channelNames = ['beauty.R', 'beauty.G', 'beauty.B', 'beauty.A', 'depth.Z'];
    const group = findCandidate(channelNames, 'group:beauty');

    expect(visibleKeys(channelNames)).toEqual(['group:beauty', 'channel:depth.Z']);
    expect(visibleKeys(channelNames, true)).toEqual([
      'channel:beauty.R',
      'channel:beauty.G',
      'channel:beauty.B',
      'channel:beauty.A',
      'channel:depth.Z'
    ]);
    expect(group).toMatchObject({
      kind: 'componentGroup',
      ruleId: 'component.rgb',
      label: 'beauty.(R,G,B,A)',
      priority: 10,
      splitChildren: [
        'channel:beauty.R',
        'channel:beauty.G',
        'channel:beauty.B',
        'channel:beauty.A'
      ]
    });
    expect(selectionKey(group)).toBe('channelRgb:beauty.R:beauty.G:beauty.B:beauty.A');
  });

  it('recognizes declarative XYZ and UV component groups', () => {
    const channelNames = [
      'normal.X',
      'normal.Y',
      'normal.Z',
      'motion.U',
      'motion.V',
      'motion.A',
      'depth.Z'
    ];
    const xyz = findCandidate(channelNames, 'groupXYZ:normal');
    const uv = findCandidate(channelNames, 'groupUV:motion');

    expect(visibleKeys(channelNames)).toEqual(['groupXYZ:normal', 'groupUV:motion', 'channel:depth.Z']);
    expect(visibleKeys(channelNames, true)).toEqual([
      'channel:normal.X',
      'channel:normal.Y',
      'channel:normal.Z',
      'channel:motion.U',
      'channel:motion.V',
      'channel:motion.A',
      'channel:depth.Z'
    ]);
    expect(selectionKey(xyz)).toBe('channelRgb:normal.X:normal.Y:normal.Z:');
    expect(selectionKey(uv)).toBe('channelRgb:motion.U:motion.V::motion.A');
    expect(selectionKey(findCandidate(['U', 'V'], 'groupUV:'))).toBe('channelRgb:U:V::');
  });

  it('recognizes spectral RGB series and hides wavelength children from merged channel view', () => {
    const channelNames = ['410nm', '500nm', '650nm', 'mask'];
    const spectral = findCandidate(channelNames, 'spectralRgb:');
    const wavelength = findCandidate(channelNames, 'channel:410nm');

    expect(visibleKeys(channelNames)).toEqual(['channel:mask', 'spectralRgb:']);
    expect(visibleKeys(channelNames, true)).toEqual([
      'channel:410nm',
      'channel:500nm',
      'channel:650nm',
      'channel:mask'
    ]);
    expect(spectral).toMatchObject({
      kind: 'spectralSeries',
      ruleId: 'spectral.series',
      priority: 50,
      splitChildren: ['channel:410nm', 'channel:500nm', 'channel:650nm']
    });
    expect(wavelength?.metadata.hiddenInMergedChannelView).toBe(true);
    expect(selectionKey(spectral)).toBe('spectralRgb:');
  });

  it('preserves spectral series ordering and duplicate wavelength ordering', () => {
    expect(visibleKeys([
      'hoge.450nm',
      'fuga.450nm',
      'hoge.550nm',
      'fuga.550nm'
    ]).filter((key) => key.startsWith('spectralRgb:'))).toEqual([
      'spectralRgb:hoge',
      'spectralRgb:fuga'
    ]);

    expect(findCandidate(['600nm', 'HOGE500nm', 'FUGA500nm', '400nm'], 'spectralRgb:')?.channels).toEqual([
      '400nm',
      'HOGE500nm',
      'FUGA500nm',
      '600nm'
    ]);
  });

  it('recognizes scalar and RGB Stokes options with S3 availability metadata', () => {
    const linearStokes = ['S0', 'S1', 'S2'];
    const fullStokes = ['S0', 'S1', 'S2', 'S3'];
    const rgbStokes = [
      'S0.R', 'S0.G', 'S0.B',
      'S1.R', 'S1.G', 'S1.B',
      'S2.R', 'S2.G', 'S2.B',
      'S3.R', 'S3.G', 'S3.B'
    ];

    expect(visibleKeys(linearStokes).filter((key) => key.startsWith('stokesScalar:'))).toEqual([
      'stokesScalar:s1_over_s0',
      'stokesScalar:s2_over_s0',
      'stokesScalar:aolp',
      'stokesScalar:dop',
      'stokesScalar:dolp'
    ]);
    expect(findCandidate(linearStokes, 'stokesScalar:dop')?.metadata.hasS3).toBe(false);
    expect(visibleKeys(fullStokes).filter((key) => key.startsWith('stokesScalar:'))).toEqual([
      'stokesScalar:s1_over_s0',
      'stokesScalar:s2_over_s0',
      'stokesScalar:s3_over_s0',
      'stokesScalar:aolp',
      'stokesScalar:dop',
      'stokesScalar:dolp',
      'stokesScalar:docp',
      'stokesScalar:cop',
      'stokesScalar:top'
    ]);
    expect(findCandidate(fullStokes, 'stokesScalar:docp')?.metadata.hasS3).toBe(true);
    expect(visibleKeys(rgbStokes).filter((key) => key.startsWith('stokesRgb:') && key.endsWith(':group'))).toContain(
      'stokesRgb:top:group'
    );
    expect(visibleKeys(rgbStokes, true).filter((key) => key.startsWith('stokesRgb:s1_over_s0:'))).toEqual([
      'stokesRgb:s1_over_s0:R',
      'stokesRgb:s1_over_s0:G',
      'stokesRgb:s1_over_s0:B'
    ]);
  });

  it('recognizes spectral Stokes grouped and split presentations', () => {
    const channelNames = [
      'S0.400nm', 'S1.400nm', 'S2.400nm', 'S3.400nm',
      'S0.500nm', 'S1.500nm', 'S2.500nm', 'S3.500nm'
    ];

    expect(visibleKeys(channelNames).filter((key) => key.startsWith('spectralRgb:'))).toEqual([
      'spectralRgb:S0',
      'spectralRgb:S1',
      'spectralRgb:S2',
      'spectralRgb:S3'
    ]);
    expect(visibleKeys(channelNames).filter((key) => key.startsWith('stokesSpectralRgb:'))).toContain(
      'stokesSpectralRgb:top:group'
    );
    expect(visibleKeys(channelNames)).not.toContain('stokesScalar:s1_over_s0:400nm');
    expect(visibleKeys(channelNames, true)).toContain('stokesScalar:s1_over_s0:400nm');
  });

  it('leaves spectral channels and spectral Stokes scalars visible when grouping is disabled', () => {
    expect(visibleKeys(['410nm', '500nm', '650nm'], false, {
      spectralRgbGroupingEnabled: false
    })).toEqual(['channel:410nm', 'channel:500nm', 'channel:650nm']);

    const channelNames = [
      'S0.400nm', 'S1.400nm', 'S2.400nm', 'S3.400nm',
      'S0.500nm', 'S1.500nm', 'S2.500nm', 'S3.500nm'
    ];
    const keys = visibleKeys(channelNames, false, { spectralRgbGroupingEnabled: false });

    expect(keys.some((key) => key.startsWith('spectralRgb:'))).toBe(false);
    expect(keys.some((key) => key.startsWith('stokesSpectralRgb:'))).toBe(false);
    expect(keys).toContain('stokesScalar:s1_over_s0:400nm');
  });

  it('recognizes scalar and RGB Mueller matrix candidates', () => {
    const scalarNames = [
      ...MUELLER_MATRIX_ELEMENTS,
      ...MUELLER_MATRIX_ELEMENTS.map((element) => `${element}.Y`)
    ];
    const rgbNames = MUELLER_MATRIX_ELEMENTS.flatMap((element) => [
      `${element}.R`,
      `${element}.G`,
      `${element}.B`
    ]);

    expect(visibleKeys(scalarNames).filter((key) => key.startsWith('muellerMatrix'))).toEqual([
      'muellerMatrix:',
      'muellerMatrix:Y'
    ]);
    expect(findCandidate(scalarNames, 'muellerMatrix:Y')?.metadata.channelCount).toBe(16);
    expect(visibleKeys(rgbNames).filter((key) => key.startsWith('muellerMatrix'))).toEqual([
      'muellerMatrixRgb:'
    ]);
    expect(findCandidate(rgbNames, 'muellerMatrixRgb:')?.metadata.channelCount).toBe(48);
    expect(visibleKeys(rgbNames, true).filter((key) => key.startsWith('muellerMatrix'))).toEqual([
      'muellerMatrix:R',
      'muellerMatrix:G',
      'muellerMatrix:B'
    ]);
  });

  it('exposes default priority, exact Y preference, alpha repair candidates, and fallback candidates', () => {
    const rgbMuellerNames = MUELLER_MATRIX_ELEMENTS.flatMap((element) => [
      `${element}.R`,
      `${element}.G`,
      `${element}.B`
    ]);

    expect(defaultSelectionKey(['R', 'G', 'B', 'Y'])).toBe('channelRgb:R:G:B:');
    expect(defaultSelectionKey(['normal.X', 'normal.Y', 'normal.Z', 'Y'])).toBe(
      'channelRgb:normal.X:normal.Y:normal.Z:'
    );
    expect(defaultSelectionKey(['400nm', '500nm', 'Y'])).toBe('spectralRgb:');
    expect(defaultSelectionKey(['Z', 'Y', 'mask'])).toBe('channelMono:Y:');
    expect(visibleKeys(['Z', 'Y', 'mask'])).toEqual(['channel:Y', 'channel:Z', 'channel:mask']);
    expect(findCandidate(['Z', 'Y', 'mask'], 'channel:Y')?.metadata.defaultReason).toBe('exactY');
    expect(defaultSelectionKey(['foo.Z', 'foo.Y'])).toBe('channelMono:foo.Z:');
    expect(findCandidate(['foo.Z', 'foo.Y'], 'channel:foo.Y')?.metadata.defaultReason).toBe('fallback');
    expect(visibleKeys(['foo.Z', 'foo.Y', 'Y'])).toEqual(['channel:Y', 'channel:foo.Z', 'channel:foo.Y']);
    expect(defaultSelectionKey(rgbMuellerNames)).toBe('muellerMatrixRgb:');
    expect(defaultSelectionKey(MUELLER_MATRIX_ELEMENTS.slice(0, -1))).toBe('channelMono:M00:');
    expect(defaultSelectionKey(['A', 'Z'])).toBe('channelMono:Z:A');

    const mergedDepth = visibleCandidates(['depth.Z', 'depth.A', 'A'])
      .find((candidate) => candidate.key === 'channel:depth.Z');
    const splitDepth = visibleCandidates(['depth.Z', 'depth.A', 'A'], true)
      .find((candidate) => candidate.key === 'channel:depth.Z');
    expect(selectionKey(mergedDepth ?? null)).toBe('channelMono:depth.Z:depth.A');
    expect(selectionKey(splitDepth ?? null)).toBe('channelMono:depth.Z:');
  });
});
