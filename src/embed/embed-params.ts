import {
  decodeEmbedViewerState,
  encodeEmbedViewerState,
  type EmbedViewerStateSnapshot
} from './embed-state';
import type { ViewerSessionState } from '../types';

export type EmbedBottomPanelMode = 'probe' | 'channels' | 'none';

export interface EmbedPanoramaAnimationConfig {
  autoRotate: boolean;
  rotationSpeedDegPerSecond: number;
}

export interface ViewerBootstrapParams {
  uiMode: 'full' | 'embed';
  src: string | null;
  name: string | null;
  view: ViewerSessionState['viewerMode'] | null;
  autoLoad: boolean;
  bottomPanel: EmbedBottomPanelMode;
  panoramaAnimation: EmbedPanoramaAnimationConfig;
  handoffId: string | null;
  state: EmbedViewerStateSnapshot | null;
}

export interface FullViewerUrlOptions {
  baseUrl: string;
  src?: string | null;
  name?: string | null;
  handoffId?: string | null;
  state?: EmbedViewerStateSnapshot | null;
}

export const DEFAULT_PANORAMA_ROTATION_SPEED_DEG_PER_SECOND = 6;
export const MIN_PANORAMA_ROTATION_SPEED_DEG_PER_SECOND = -60;
export const MAX_PANORAMA_ROTATION_SPEED_DEG_PER_SECOND = 60;

export function parseViewerBootstrapParams(location: Pick<Location, 'search' | 'hash'>): ViewerBootstrapParams {
  const params = mergeParams(parseSearchParams(location.search), parseHashParams(location.hash));
  return {
    uiMode: params.get('ui') === 'embed' || params.get('embed') === '1' ? 'embed' : 'full',
    src: normalizeNonEmpty(params.get('src')),
    name: normalizeNonEmpty(params.get('name')),
    view: parseViewerMode(params.get('view')),
    autoLoad: parseBooleanParam(params.get('autoLoad') ?? params.get('autoload')),
    bottomPanel: parseEmbedBottomPanelMode(params.get('bottomPanel')),
    panoramaAnimation: {
      autoRotate: parseFalseDefaultBooleanParam(
        params.get('panoramaAutoRotate') ?? params.get('panorama-auto-rotate')
      ),
      rotationSpeedDegPerSecond: parsePanoramaRotationSpeed(
        params.get('panoramaRotationSpeed') ?? params.get('panorama-rotation-speed')
      )
    },
    handoffId: normalizeNonEmpty(params.get('handoff')),
    state: decodeEmbedViewerState(params.get('state'))
  };
}

export function buildFullViewerUrl({
  baseUrl,
  src,
  name,
  handoffId,
  state
}: FullViewerUrlOptions): string {
  const url = new URL(baseUrl, window.location.href);
  const params = url.searchParams;
  if (src) {
    params.set('src', src);
  }
  if (name) {
    params.set('name', name);
  }
  const encodedState = encodeEmbedViewerState(state);
  if (encodedState) {
    params.set('state', encodedState);
  }
  if (handoffId) {
    url.hash = `handoff=${encodeURIComponent(handoffId)}`;
  }
  return url.toString();
}

function parseSearchParams(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
}

function parseHashParams(hash: string): URLSearchParams {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const query = raw.startsWith('?') ? raw.slice(1) : raw;
  return new URLSearchParams(query);
}

function mergeParams(primary: URLSearchParams, secondary: URLSearchParams): URLSearchParams {
  const merged = new URLSearchParams(primary);
  for (const [key, value] of secondary) {
    if (!merged.has(key)) {
      merged.set(key, value);
    }
  }
  return merged;
}

function normalizeNonEmpty(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function parseViewerMode(value: string | null): ViewerSessionState['viewerMode'] | null {
  return value === 'image' || value === 'panorama' || value === '3d' ? value : null;
}

function parseEmbedBottomPanelMode(value: string | null): EmbedBottomPanelMode {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (normalized === 'channels' || normalized === 'none') {
    return normalized;
  }
  return 'probe';
}

function parseBooleanParam(value: string | null): boolean {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return true;
}

function parseFalseDefaultBooleanParam(value: string | null): boolean {
  if (value === null) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return !(normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off');
}

export function parsePanoramaRotationSpeed(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return DEFAULT_PANORAMA_ROTATION_SPEED_DEG_PER_SECOND;
  }

  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed)) {
    return DEFAULT_PANORAMA_ROTATION_SPEED_DEG_PER_SECOND;
  }

  return Math.min(
    MAX_PANORAMA_ROTATION_SPEED_DEG_PER_SECOND,
    Math.max(MIN_PANORAMA_ROTATION_SPEED_DEG_PER_SECOND, parsed)
  );
}
