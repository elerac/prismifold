import { normalizeAutoExposurePercentile } from '../../analysis/auto-exposure';
import { idleResource } from '../../async-resource';
import {
  createDefaultChannelRecognitionSettings,
  deriveSpectralRgbGroupingEnabled,
  normalizeChannelRecognitionSettings,
  sameChannelRecognitionSettings,
  withChannelRecognitionSetting,
  type ChannelRecognitionSettings
} from '../../channel-recognition-settings';
import { sameDisplaySelection } from '../../display-model';
import { resolveDisplaySelectionForLayer } from '../../display-selection';
import {
  activateViewerPane,
  resetViewerPaneLayout,
  splitActiveViewerPane,
  sameViewerPaneLayout
} from '../../viewer-pane-layout';
import { selectActiveSession } from '../viewer-app-selectors';
import type { ViewerAppState, ViewerIntent } from '../viewer-app-types';
import { patchSessionState, type ViewerReducerContext } from './shared';

export function uiPreferencesReducer(
  state: ViewerAppState,
  intent: ViewerIntent,
  _context: ViewerReducerContext
): ViewerAppState {
  switch (intent.type) {
    case 'autoFitImageOnSelectSet':
      return state.autoFitImageOnSelect === intent.enabled ? state : {
        ...state,
        autoFitImageOnSelect: intent.enabled
      };
    case 'autoExposureSet':
      return state.autoExposureEnabled === intent.enabled ? state : {
        ...state,
        autoExposureEnabled: intent.enabled,
        autoExposureResource: intent.enabled ? state.autoExposureResource : idleResource()
      };
    case 'autoExposurePercentileSet': {
      const percentile = normalizeAutoExposurePercentile(intent.percentile);
      return state.autoExposurePercentile === percentile ? state : {
        ...state,
        autoExposurePercentile: percentile,
        autoExposureResource: idleResource()
      };
    }
    case 'rulersVisibleSet':
      return state.rulersVisible === intent.enabled ? state : {
        ...state,
        rulersVisible: intent.enabled
      };
    case 'maskInvalidStokesVectorsSet':
      return state.maskInvalidStokesVectors === intent.enabled ? state : {
        ...state,
        maskInvalidStokesVectors: intent.enabled,
        displayRangeResource: idleResource(),
        imageStatsResource: idleResource(),
        autoExposureResource: idleResource()
      };
    case 'spectralRgbGroupingSet':
      return reduceSpectralRgbGroupingSet(state, intent.enabled);
    case 'channelRecognitionSettingsSet':
      return reduceChannelRecognitionSettingsSet(state, intent.settings);
    case 'channelRecognitionSettingsGroupSet':
      return reduceChannelRecognitionSettingsSet(
        state,
        withChannelRecognitionSetting(state.channelRecognitionSettings, intent.id, intent.enabled)
      );
    case 'channelRecognitionSettingsReset':
      return reduceChannelRecognitionSettingsSet(state, createDefaultChannelRecognitionSettings());
    case 'invalidValueWarningSet':
      return state.invalidValueWarningEnabled === intent.enabled ? state : {
        ...state,
        invalidValueWarningEnabled: intent.enabled
      };
    case 'viewerPaneReset': {
      const viewerPaneLayout = resetViewerPaneLayout(state.activeSessionId);
      return sameViewerPaneLayout(state.viewerPaneLayout, viewerPaneLayout) ? state : {
        ...state,
        viewerPaneLayout
      };
    }
    case 'viewerPaneActivated': {
      const viewerPaneLayout = activateViewerPane(state.viewerPaneLayout, intent.path);
      return viewerPaneLayout === state.viewerPaneLayout ? state : {
        ...state,
        viewerPaneLayout
      };
    }
    case 'viewerPaneSplit': {
      const viewerPaneLayout = splitActiveViewerPane(state.viewerPaneLayout, intent.orientation);
      return {
        ...state,
        viewerPaneLayout
      };
    }
    default:
      return state;
  }
}

function reduceChannelRecognitionSettingsSet(
  state: ViewerAppState,
  settings: ChannelRecognitionSettings
): ViewerAppState {
  const nextSettings = normalizeChannelRecognitionSettings(settings);
  if (sameChannelRecognitionSettings(state.channelRecognitionSettings, nextSettings)) {
    return state;
  }

  const nextState: ViewerAppState = {
    ...state,
    channelRecognitionSettings: nextSettings,
    spectralRgbGroupingEnabled: deriveSpectralRgbGroupingEnabled(nextSettings),
    displayRangeResource: idleResource(),
    imageStatsResource: idleResource(),
    autoExposureResource: idleResource()
  };
  const activeSession = selectActiveSession(nextState);
  const layer = activeSession?.decoded.layers[nextState.sessionState.activeLayer] ?? null;
  if (!layer) {
    return nextState;
  }

  const displaySelection = resolveDisplaySelectionForLayer(
    layer.channelNames,
    nextState.sessionState.displaySelection,
    {
      stokesParameterVisibility: nextState.stokesParameterVisibility,
      spectralRgbGroupingEnabled: nextState.spectralRgbGroupingEnabled,
      channelRecognitionSettings: nextSettings
    }
  );
  if (sameDisplaySelection(displaySelection, nextState.sessionState.displaySelection)) {
    return nextState;
  }

  return patchSessionState(nextState, { displaySelection }, {
    clearHover: true,
    resetDisplayRangeContext: true
  });
}

function reduceSpectralRgbGroupingSet(state: ViewerAppState, enabled: boolean): ViewerAppState {
  const channelRecognitionSettings = normalizeChannelRecognitionSettings({
    ...state.channelRecognitionSettings,
    'spectral.series': enabled,
    'stokes.spectral': enabled
  });
  if (
    state.spectralRgbGroupingEnabled === enabled &&
    sameChannelRecognitionSettings(state.channelRecognitionSettings, channelRecognitionSettings)
  ) {
    return state;
  }

  const nextState: ViewerAppState = {
    ...state,
    channelRecognitionSettings,
    spectralRgbGroupingEnabled: enabled,
    displayRangeResource: idleResource(),
    imageStatsResource: idleResource(),
    autoExposureResource: idleResource()
  };
  const activeSession = selectActiveSession(nextState);
  const layer = activeSession?.decoded.layers[nextState.sessionState.activeLayer] ?? null;
  if (!layer) {
    return nextState;
  }

  const displaySelection = resolveDisplaySelectionForLayer(
    layer.channelNames,
    nextState.sessionState.displaySelection,
    {
      stokesParameterVisibility: nextState.stokesParameterVisibility,
      spectralRgbGroupingEnabled: enabled,
      channelRecognitionSettings
    }
  );
  if (sameDisplaySelection(displaySelection, nextState.sessionState.displaySelection)) {
    return nextState;
  }

  return patchSessionState(nextState, { displaySelection }, {
    clearHover: true,
    resetDisplayRangeContext: true
  });
}
