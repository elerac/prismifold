import {
  buildChannelMonoSelection,
  buildChannelRgbSelection,
  extractComponentChannelGroups,
  extractRgbChannelGroups,
  findRecognizedCandidateForSelection,
  findSelectedComponentChannelGroup,
  pickDefaultRecognizedCandidate,
  recognizeLayerChannels,
  resolveAlphaChannelForChannel,
  type ComponentGroupCandidate,
  type RecognizedChannelCandidate,
  type RgbChannelGroup,
  type SingleChannelCandidate
} from './channel-recognition';
import {
  sameDisplaySelection,
  type ChannelSelection,
  type DisplaySelection
} from './display-model';
import type { DisplayChannelMapping } from './types';
import type { StokesParameterVisibilitySettings } from './stokes';

export type { RgbChannelGroup } from './channel-recognition';

export interface ChannelDisplayOption {
  key: string;
  label: string;
  selection: ChannelSelection;
  mapping: DisplayChannelMapping;
}

export interface ChannelDisplayOptionsConfig {
  includeRgbGroups?: boolean;
  includeSplitChannels?: boolean;
  includeAlphaCompanions?: boolean;
}

export interface DisplaySelectionAvailabilityConfig {
  stokesParameterVisibility?: StokesParameterVisibilitySettings;
  spectralRgbGroupingEnabled?: boolean;
}

export function pickDefaultDisplaySelection(
  channelNames: string[],
  config: DisplaySelectionAvailabilityConfig = {}
): DisplaySelection | null {
  return pickDefaultRecognizedCandidate(recognizeLayerChannels(channelNames, config))?.selection ?? null;
}

export function resolveDisplaySelectionForLayer(
  channelNames: string[],
  currentSelection: DisplaySelection | null,
  config: DisplaySelectionAvailabilityConfig = {}
): DisplaySelection | null {
  if (!currentSelection) {
    return pickDefaultDisplaySelection(channelNames, config);
  }

  if (currentSelection.kind === 'channelMono' || currentSelection.kind === 'channelRgb') {
    const normalized = normalizeChannelSelection(channelNames, currentSelection);
    return normalized ?? pickDefaultDisplaySelection(channelNames, config);
  }

  const recognition = recognizeLayerChannels(channelNames, config);
  return findRecognizedCandidateForSelection(recognition, currentSelection)
    ? currentSelection
    : pickDefaultDisplaySelection(channelNames, config);
}

export { extractRgbChannelGroups, resolveAlphaChannelForChannel };

export function findSelectedRgbGroup(
  groups: RgbChannelGroup[],
  displayR: string,
  displayG: string,
  displayB: string
): RgbChannelGroup | null {
  return groups.find((group) => group.r === displayR && group.g === displayG && group.b === displayB) ?? null;
}

export function buildChannelDisplayOptions(
  channelNames: string[],
  config: ChannelDisplayOptionsConfig = {}
): ChannelDisplayOption[] {
  const includeRgbGroups = config.includeRgbGroups ?? true;
  const includeSplitChannels = config.includeSplitChannels ?? false;
  const includeAlphaCompanions = config.includeAlphaCompanions ?? !includeSplitChannels;
  const recognition = recognizeLayerChannels(channelNames, {
    includeAlphaCompanions
  });

  return recognition.candidates
    .filter((candidate) => {
      if (candidate.kind === 'componentGroup') {
        return includeRgbGroups;
      }

      if (candidate.kind !== 'singleChannel') {
        return false;
      }

      return includeSplitChannels
        ? candidate.availability.split
        : candidate.availability.merged;
    })
    .filter(isChannelDisplayCandidate)
    .sort((a, b) => a.sourceOrder - b.sourceOrder)
    .map((candidate) => ({
      key: candidate.key,
      label: candidate.label,
      selection: candidate.selection,
      mapping: candidate.mapping
    }));
}

export function findSelectedChannelDisplayOption(
  options: ChannelDisplayOption[],
  selected: DisplaySelection | null
): ChannelDisplayOption | null {
  if (!selected || (selected.kind !== 'channelMono' && selected.kind !== 'channelRgb')) {
    return null;
  }

  return options.find((option) => sameDisplaySelection(option.selection, selected)) ?? null;
}

export function findMergedSelectionForSplitDisplay(
  channelNames: string[],
  selected: DisplaySelection | null
): DisplaySelection | null {
  if (!selected) {
    return null;
  }

  const recognition = recognizeLayerChannels(channelNames);
  const splitCandidate = findRecognizedCandidateForSelection(recognition, selected, 'split');
  if (!splitCandidate?.mergedParentKey) {
    return null;
  }

  return recognition.candidates.find((candidate) => (
    candidate.availability.merged &&
    candidate.key === splitCandidate.mergedParentKey
  ))?.selection ?? null;
}

export function findSplitSelectionForMergedDisplay(
  channelNames: string[],
  selected: DisplaySelection | null
): DisplaySelection | null {
  if (!selected) {
    return null;
  }

  const recognition = recognizeLayerChannels(channelNames);
  const mergedCandidate = findRecognizedCandidateForSelection(recognition, selected, 'merged');
  if (!mergedCandidate || mergedCandidate.splitChildren.length === 0) {
    return null;
  }

  const splitChildKeys = new Set(mergedCandidate.splitChildren);
  return recognition.candidates.find((candidate) => (
    candidate.availability.split &&
    splitChildKeys.has(candidate.key) &&
    candidate.mergedParentKey === mergedCandidate.key
  ))?.selection ?? null;
}

function normalizeChannelSelection(
  channelNames: string[],
  selection: ChannelSelection
): ChannelSelection | null {
  if (selection.kind === 'channelMono') {
    return channelNames.includes(selection.channel)
      ? buildChannelMonoSelection(channelNames, selection.channel)
      : null;
  }

  const group = findSelectedComponentChannelGroup(
    extractComponentChannelGroups(channelNames),
    selection.r,
    selection.g,
    selection.b
  );
  return group ? buildChannelRgbSelection(group) : null;
}

function isChannelDisplayCandidate(
  candidate: RecognizedChannelCandidate
): candidate is ComponentGroupCandidate | SingleChannelCandidate {
  return candidate.selection.kind === 'channelMono' || candidate.selection.kind === 'channelRgb';
}
