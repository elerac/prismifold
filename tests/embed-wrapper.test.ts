// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const EMBED_LOAD_FILE_MESSAGE = 'plenoview:load-file';
const EMBED_LOAD_ERROR_MESSAGE = 'plenoview:load-error';
const EMBED_CONFIG_MESSAGE = 'plenoview:embed-config';
const EMBED_READY_MESSAGE = 'plenoview:embed-ready';
const EMBED_DEFERRED_LOAD_MESSAGE = 'plenoview:deferred-load';
const embedScript = readFileSync(resolve(process.cwd(), 'public/embed/plenoview.js'), 'utf8');
const originalFetch = window.fetch;
const originalIframeContentWindow = Object.getOwnPropertyDescriptor(
  HTMLIFrameElement.prototype,
  'contentWindow'
);

interface PlenoviewViewerElementForTest extends HTMLElement {
  viewerOrigin: string;
  viewerTargetOrigin: string;
  loadFile(file: File, options?: {
    name?: string;
    view?: string;
    panoramaAutoRotate?: boolean | string;
    panoramaRotationSpeed?: number | string;
    threeDAutoOrbit?: boolean | string;
    threeDOrbitSpeed?: number | string;
    threeDOrbitYaw?: number | string;
    threeDOrbitPitch?: number | string;
  }): Promise<void>;
  loadUrl(src: string, options?: {
    name?: string;
    sourceOrigin?: string;
    view?: string;
    panoramaAutoRotate?: boolean | string;
    panoramaRotationSpeed?: number | string;
    threeDAutoOrbit?: boolean | string;
    threeDOrbitSpeed?: number | string;
    threeDOrbitYaw?: number | string;
    threeDOrbitPitch?: number | string;
  }): Promise<void>;
  setView(view: string): void;
  setPanoramaAutoRotate(enabled: boolean | string): void;
  setPanoramaRotationSpeed(speedDegPerSecond: number | string): void;
  setThreeDAutoOrbit(enabled: boolean | string): void;
  setThreeDOrbitSpeed(speedDegPerSecond: number | string): void;
  setThreeDOrbitYaw(yawAmplitudeDeg: number | string): void;
  setThreeDOrbitPitch(pitchAmplitudeDeg: number | string): void;
}

interface PlenoviewControllerForTest {
  element: PlenoviewViewerElementForTest;
  loadFile(file: File, options?: {
    name?: string;
    view?: string;
    panoramaAutoRotate?: boolean | string;
    panoramaRotationSpeed?: number | string;
    threeDAutoOrbit?: boolean | string;
    threeDOrbitSpeed?: number | string;
    threeDOrbitYaw?: number | string;
    threeDOrbitPitch?: number | string;
  }): Promise<void>;
  loadUrl(src: string, options?: {
    name?: string;
    sourceOrigin?: string;
    view?: string;
    panoramaAutoRotate?: boolean | string;
    panoramaRotationSpeed?: number | string;
    threeDAutoOrbit?: boolean | string;
    threeDOrbitSpeed?: number | string;
    threeDOrbitYaw?: number | string;
    threeDOrbitPitch?: number | string;
  }): Promise<void>;
  setView(view: string): PlenoviewControllerForTest;
  setPanoramaAutoRotate(enabled: boolean | string): PlenoviewControllerForTest;
  setPanoramaRotationSpeed(speedDegPerSecond: number | string): PlenoviewControllerForTest;
  setThreeDAutoOrbit(enabled: boolean | string): PlenoviewControllerForTest;
  setThreeDOrbitSpeed(speedDegPerSecond: number | string): PlenoviewControllerForTest;
  setThreeDOrbitYaw(yawAmplitudeDeg: number | string): PlenoviewControllerForTest;
  setThreeDOrbitPitch(pitchAmplitudeDeg: number | string): PlenoviewControllerForTest;
  destroy(): void;
}

interface PlenoviewApiForTest {
  create(target: string | HTMLElement, options?: {
    src?: string;
    file?: File;
    name?: string;
    view?: string;
    width?: number | string;
    height?: number | string;
    viewerUrl?: string;
    sourceOrigin?: string;
    bottomPanel?: string;
    panoramaAutoRotate?: boolean | string;
    panoramaRotationSpeed?: number | string;
    threeDAutoOrbit?: boolean | string;
    threeDOrbitSpeed?: number | string;
    threeDOrbitYaw?: number | string;
    threeDOrbitPitch?: number | string;
    autoLoad?: boolean | string;
  }): PlenoviewControllerForTest;
}

interface PlenoviewWindowForTest extends Window {
  Plenoview: PlenoviewApiForTest;
}

beforeAll(() => {
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
    configurable: true,
    get() {
      return window;
    }
  });
  window.eval(embedScript);
});

afterAll(() => {
  if (originalIframeContentWindow) {
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', originalIframeContentWindow);
  }
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  if (originalFetch) {
    Object.defineProperty(window, 'fetch', {
      configurable: true,
      writable: true,
      value: originalFetch
    });
  } else {
    Reflect.deleteProperty(window, 'fetch');
  }
});

describe('embed wrapper public script', () => {
  it('registers the custom element and global JS API', () => {
    expect(customElements.get('plenoview-viewer')).toEqual(expect.any(Function));
    expect(getPlenoview().create).toEqual(expect.any(Function));
    const legacyElementName = ['openexr', 'viewer'].join('-');
    const legacyGlobalName = ['Open', 'Exr', 'Viewer'].join('');
    expect(customElements.get(legacyElementName)).toBeUndefined();
    expect((window as unknown as Record<string, unknown>)[legacyGlobalName]).toBeUndefined();
  });

  it('creates iframe-backed viewers with expected attributes', () => {
    document.body.innerHTML = '<div id="target"></div>';

    const controller = getPlenoview().create('#target', {
      src: 'https://example.com/render.exr',
      name: 'Beauty pass',
      width: 300,
      height: 240,
      view: 'panorama',
      bottomPanel: 'channels',
      panoramaAutoRotate: true,
      panoramaRotationSpeed: 12.5
    });

    const iframe = getViewerIframe(controller.element);
    const iframeUrl = new URL(iframe.src);

    expect(controller.element.parentElement?.id).toBe('target');
    expect(controller.element.style.width).toBe('300px');
    expect(controller.element.getAttribute('name')).toBe('Beauty pass');
    expect(controller.element.getAttribute('bottom-panel')).toBe('channels');
    expect(controller.element.getAttribute('panorama-auto-rotate')).toBe('true');
    expect(controller.element.getAttribute('panorama-rotation-speed')).toBe('12.5');
    expect(iframe.style.height).toBe('240px');
    expect(iframe.allowFullscreen).toBe(false);
    expect(iframeUrl.pathname).toBe('/app/');
    expect(iframeUrl.searchParams.get('ui')).toBe('embed');
    expect(iframeUrl.searchParams.get('src')).toBe('https://example.com/render.exr');
    expect(iframeUrl.searchParams.get('name')).toBe('Beauty pass');
    expect(iframeUrl.searchParams.get('view')).toBe('panorama');
    expect(iframeUrl.searchParams.get('bottomPanel')).toBe('channels');
    expect(iframeUrl.searchParams.get('panoramaAutoRotate')).toBe('true');
    expect(iframeUrl.searchParams.get('panoramaRotationSpeed')).toBe('12.5');
  });

  it('creates iframe-backed 3D orbit viewers with expected params', () => {
    document.body.innerHTML = '<div id="target"></div>';

    const controller = getPlenoview().create('#target', {
      src: 'https://example.com/depth.exr',
      name: 'Depth pass',
      view: '3d',
      threeDAutoOrbit: true,
      threeDOrbitSpeed: 9,
      threeDOrbitYaw: 14,
      threeDOrbitPitch: 3
    });

    const iframeUrl = new URL(getViewerIframe(controller.element).src);

    expect(controller.element.getAttribute('three-d-auto-orbit')).toBe('true');
    expect(controller.element.getAttribute('three-d-orbit-speed')).toBe('9');
    expect(controller.element.getAttribute('three-d-orbit-yaw')).toBe('14');
    expect(controller.element.getAttribute('three-d-orbit-pitch')).toBe('3');
    expect(iframeUrl.searchParams.get('view')).toBe('3d');
    expect(iframeUrl.searchParams.get('threeDAutoOrbit')).toBe('true');
    expect(iframeUrl.searchParams.get('threeDOrbitSpeed')).toBe('9');
    expect(iframeUrl.searchParams.get('threeDOrbitYaw')).toBe('14');
    expect(iframeUrl.searchParams.get('threeDOrbitPitch')).toBe('3');
  });

  it('passes bottom-panel markup through and omits the default probe query param', () => {
    const defaultElement = document.createElement('plenoview-viewer');
    defaultElement.setAttribute('src', 'https://example.com/default.exr');
    document.body.append(defaultElement);

    expect(new URL(getViewerIframe(defaultElement).src).searchParams.get('bottomPanel')).toBeNull();

    const noneElement = document.createElement('plenoview-viewer');
    noneElement.setAttribute('src', 'https://example.com/hidden.exr');
    noneElement.setAttribute('bottom-panel', 'none');
    document.body.append(noneElement);

    expect(new URL(getViewerIframe(noneElement).src).searchParams.get('bottomPanel')).toBe('none');
  });

  it('parent-fetches relative sources and posts them to the iframe', async () => {
    document.body.innerHTML = '<div id="target"></div>';
    const fetchMock = stubFetchOk();

    const controller = getPlenoview().create('#target', {
      src: './public/cbox_rgb.exr',
      name: 'Cornell Box',
      width: 300,
      height: 300,
      view: 'panorama'
    });
    const iframe = getViewerIframe(controller.element);
    const postMessage = spyOnIframePostMessage(iframe);

    dispatchEmbedReady(controller.element, iframe);
    await flushPromises();

    const posted = postMessage.mock.calls[0]?.[0] as {
      type: string;
      file: File;
      name?: string;
      state?: { viewerMode?: string } | null;
    };
    expect(fetchMock).toHaveBeenCalledWith(new URL('./public/cbox_rgb.exr', document.baseURI).toString());
    expect(new URL(iframe.src).searchParams.get('src')).toBeNull();
    expect(new URL(iframe.src).searchParams.get('view')).toBe('panorama');
    expect(posted).toMatchObject({
      type: EMBED_LOAD_FILE_MESSAGE,
      name: 'Cornell Box',
      state: {
        viewerMode: 'panorama'
      }
    });
    expect(posted.file).toBeInstanceOf(File);
    expect(posted.file.name).toBe('Cornell Box');
    expect(postMessage.mock.calls[0]?.[1]).toBe(controller.element.viewerTargetOrigin);
  });

  it('defers parent-fetched relative sources when autoLoad is false', async () => {
    document.body.innerHTML = '<div id="target"></div>';
    const fetchMock = stubFetchOk();

    const controller = getPlenoview().create('#target', {
      src: './public/cbox_rgb.exr',
      name: 'Deferred Cornell Box',
      view: 'panorama',
      autoLoad: false
    });
    const iframe = getViewerIframe(controller.element);
    const postMessage = spyOnIframePostMessage(iframe);
    const iframeUrl = new URL(iframe.src);

    expect(controller.element.getAttribute('auto-load')).toBe('false');
    expect(iframeUrl.searchParams.get('autoLoad')).toBe('false');
    expect(iframeUrl.searchParams.get('src')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    dispatchEmbedReady(controller.element, iframe);
    await flushPromises();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();

    dispatchEmbedDeferredLoad(controller.element, iframe);
    await flushPromises();

    const posted = postMessage.mock.calls[0]?.[0] as {
      type: string;
      file: File;
      name?: string;
      state?: { viewerMode?: string } | null;
    };
    expect(fetchMock).toHaveBeenCalledWith(new URL('./public/cbox_rgb.exr', document.baseURI).toString());
    expect(posted).toMatchObject({
      type: EMBED_LOAD_FILE_MESSAGE,
      name: 'Deferred Cornell Box',
      state: {
        viewerMode: 'panorama'
      }
    });
    expect(posted.file.name).toBe('Deferred Cornell Box');
  });

  it('posts load errors for failed deferred parent-fetched sources', async () => {
    document.body.innerHTML = '<div id="target"></div>';
    const fetchMock = stubFetchNotFound();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const controller = getPlenoview().create('#target', {
      src: './public/missing.exr',
      autoLoad: false
    });
    const iframe = getViewerIframe(controller.element);
    const postMessage = spyOnIframePostMessage(iframe);

    dispatchEmbedReady(controller.element, iframe);
    dispatchEmbedDeferredLoad(controller.element, iframe);
    await flushPromises();

    const posted = postMessage.mock.calls[0]?.[0] as {
      type: string;
      message?: string;
    };
    expect(fetchMock).toHaveBeenCalledWith(new URL('./public/missing.exr', document.baseURI).toString());
    expect(posted).toMatchObject({
      type: EMBED_LOAD_ERROR_MESSAGE,
      message: expect.stringContaining('(404)')
    });
  });

  it('keeps absolute HTTPS sources in the iframe URL by default', () => {
    document.body.innerHTML = '<div id="target"></div>';
    const fetchMock = stubFetchOk();

    const controller = getPlenoview().create('#target', {
      src: 'https://example.com/render.exr',
      name: 'Remote render'
    });
    const iframeUrl = new URL(getViewerIframe(controller.element).src);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(iframeUrl.pathname).toBe('/app/');
    expect(iframeUrl.searchParams.get('src')).toBe('https://example.com/render.exr');
  });

  it('passes autoLoad=false through for viewer-fetched absolute sources', () => {
    document.body.innerHTML = '<div id="target"></div>';
    const fetchMock = stubFetchOk();

    const controller = getPlenoview().create('#target', {
      src: 'https://example.com/render.exr',
      name: 'Deferred remote render',
      autoLoad: false
    });
    const iframeUrl = new URL(getViewerIframe(controller.element).src);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(controller.element.getAttribute('auto-load')).toBe('false');
    expect(iframeUrl.searchParams.get('src')).toBe('https://example.com/render.exr');
    expect(iframeUrl.searchParams.get('autoLoad')).toBe('false');
  });

  it('accepts autoload as a markup alias for auto-load', () => {
    const element = document.createElement('plenoview-viewer');
    element.setAttribute('src', 'https://example.com/render.exr');
    element.setAttribute('autoload', 'false');
    document.body.append(element);

    const iframeUrl = new URL(getViewerIframe(element).src);
    expect(iframeUrl.searchParams.get('autoLoad')).toBe('false');
  });

  it('forces parent fetch when sourceOrigin is parent', async () => {
    document.body.innerHTML = '<div id="target"></div>';
    const fetchMock = stubFetchOk();
    const controller = getPlenoview().create('#target');

    const loadPromise = controller.loadUrl('https://example.com/render.exr', {
      name: 'Parent fetched',
      view: 'panorama',
      sourceOrigin: 'parent'
    });
    const iframe = getViewerIframe(controller.element);
    const postMessage = spyOnIframePostMessage(iframe);

    dispatchEmbedReady(controller.element, iframe);
    await loadPromise;

    const posted = postMessage.mock.calls[0]?.[0] as {
      type: string;
      file: File;
      name?: string;
      state?: { viewerMode?: string } | null;
    };
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/render.exr');
    expect(new URL(iframe.src).searchParams.get('src')).toBeNull();
    expect(new URL(iframe.src).searchParams.get('view')).toBe('panorama');
    expect(posted.type).toBe(EMBED_LOAD_FILE_MESSAGE);
    expect(posted.name).toBe('Parent fetched');
    expect(posted.state).toEqual({
      viewerMode: 'panorama'
    });
  });

  it('supports controller loadFile, loadUrl, setView, and destroy', async () => {
    document.body.innerHTML = '<div id="target"></div>';
    const controller = getPlenoview().create('#target', {
      height: 200
    });
    const initialIframe = getViewerIframe(controller.element);
    const postMessage = spyOnIframePostMessage(initialIframe);

    dispatchEmbedReady(controller.element, initialIframe);
    await controller.loadFile(new File(['pixels'], 'local.exr'), {
      name: 'Local plate',
      view: 'panorama'
    });

    const posted = postMessage.mock.calls[0]?.[0] as {
      type: string;
      file: File;
      name?: string;
      state?: { viewerMode?: string } | null;
    };
    expect(posted.type).toBe(EMBED_LOAD_FILE_MESSAGE);
    expect(posted.file.name).toBe('local.exr');
    expect(posted.name).toBe('Local plate');
    expect(posted.state).toEqual({
      viewerMode: 'panorama'
    });
    expect(controller).not.toHaveProperty('loadGallery');

    await controller.loadUrl('https://example.com/next.exr', {
      name: 'Next plate',
      view: 'image'
    });
    const url = new URL(getViewerIframe(controller.element).src);
    expect(controller.element.getAttribute('src')).toBe('https://example.com/next.exr');
    expect(url.pathname).toBe('/app/');
    expect(url.searchParams.get('src')).toBe('https://example.com/next.exr');
    expect(url.searchParams.get('gallery')).toBeNull();
    expect(url.searchParams.get('name')).toBe('Next plate');
    expect(url.searchParams.get('view')).toBe('image');

    controller.setView('panorama');
    const panoramaUrl = new URL(getViewerIframe(controller.element).src);
    expect(panoramaUrl.pathname).toBe('/app/');
    expect(panoramaUrl.searchParams.get('view')).toBe('panorama');

    controller.destroy();
    expect(document.querySelector('plenoview-viewer')).toBeNull();
  });

  it('normalizes 3D and legacy depth view values for posted file state', async () => {
    document.body.innerHTML = '<div id="target"></div>';
    const controller = getPlenoview().create('#target');
    const iframe = getViewerIframe(controller.element);
    const postMessage = spyOnIframePostMessage(iframe);

    dispatchEmbedReady(controller.element, iframe);
    await controller.loadFile(new File(['pixels'], 'depth.exr'), {
      view: '3d',
      threeDAutoOrbit: true,
      threeDOrbitSpeed: 9,
      threeDOrbitYaw: 14,
      threeDOrbitPitch: 3
    });
    await controller.loadFile(new File(['pixels'], 'legacy-depth.exr'), {
      view: 'depth'
    });

    const postedFiles = postMessage.mock.calls
      .map((call) => call[0] as { type?: string; state?: { viewerMode?: string } | null })
      .filter((message) => message.type === EMBED_LOAD_FILE_MESSAGE);
    expect(postedFiles[0]?.state).toEqual({ viewerMode: '3d' });
    expect(postedFiles[1]?.state).toEqual({ viewerMode: '3d' });

    const configMessage = postMessage.mock.calls
      .map((call) => call[0] as {
        type?: string;
        threeDAutoOrbit?: boolean;
        threeDOrbitSpeed?: number;
        threeDOrbitYaw?: number;
        threeDOrbitPitch?: number;
      })
      .find((message) => message.type === EMBED_CONFIG_MESSAGE);
    expect(configMessage).toEqual(expect.objectContaining({
      type: EMBED_CONFIG_MESSAGE,
      threeDAutoOrbit: true,
      threeDOrbitSpeed: 9,
      threeDOrbitYaw: 14,
      threeDOrbitPitch: 3
    }));
  });

  it('live-updates panorama animation config without replacing the iframe', async () => {
    document.body.innerHTML = '<div id="target"></div>';
    const controller = getPlenoview().create('#target', {
      src: 'https://example.com/pano.exr',
      view: 'panorama',
      panoramaAutoRotate: true
    });
    const iframe = getViewerIframe(controller.element);
    const postMessage = spyOnIframePostMessage(iframe);
    dispatchEmbedReady(controller.element, iframe);

    const returned = controller
      .setPanoramaRotationSpeed(100)
      .setPanoramaAutoRotate(false);

    expect(returned).toBe(controller);
    expect(getViewerIframe(controller.element)).toBe(iframe);
    expect(controller.element.getAttribute('panorama-rotation-speed')).toBe('60');
    expect(controller.element.getAttribute('panorama-auto-rotate')).toBe('false');

    const configMessages = postMessage.mock.calls
      .map((call) => call[0] as {
        type?: string;
        panoramaAutoRotate?: boolean;
        panoramaRotationSpeed?: number;
        threeDAutoOrbit?: boolean;
        threeDOrbitSpeed?: number;
        threeDOrbitYaw?: number;
        threeDOrbitPitch?: number;
      })
      .filter((message) => message.type === EMBED_CONFIG_MESSAGE);
    expect(configMessages).toEqual([
      {
        type: EMBED_CONFIG_MESSAGE,
        panoramaAutoRotate: true,
        panoramaRotationSpeed: 60,
        threeDAutoOrbit: false,
        threeDOrbitSpeed: 6,
        threeDOrbitYaw: 12,
        threeDOrbitPitch: 2
      },
      {
        type: EMBED_CONFIG_MESSAGE,
        panoramaAutoRotate: false,
        panoramaRotationSpeed: 60,
        threeDAutoOrbit: false,
        threeDOrbitSpeed: 6,
        threeDOrbitYaw: 12,
        threeDOrbitPitch: 2
      }
    ]);
  });

  it('live-updates 3D orbit config without replacing the iframe', async () => {
    document.body.innerHTML = '<div id="target"></div>';
    const controller = getPlenoview().create('#target', {
      src: 'https://example.com/depth.exr',
      view: '3d',
      threeDAutoOrbit: true
    });
    const iframe = getViewerIframe(controller.element);
    const postMessage = spyOnIframePostMessage(iframe);
    dispatchEmbedReady(controller.element, iframe);

    const returned = controller
      .setThreeDOrbitSpeed(100)
      .setThreeDOrbitYaw(100)
      .setThreeDOrbitPitch(100)
      .setThreeDAutoOrbit(false);

    expect(returned).toBe(controller);
    expect(getViewerIframe(controller.element)).toBe(iframe);
    expect(controller.element.getAttribute('three-d-orbit-speed')).toBe('30');
    expect(controller.element.getAttribute('three-d-orbit-yaw')).toBe('30');
    expect(controller.element.getAttribute('three-d-orbit-pitch')).toBe('8');
    expect(controller.element.getAttribute('three-d-auto-orbit')).toBe('false');

    const configMessages = postMessage.mock.calls
      .map((call) => call[0] as {
        type?: string;
        threeDAutoOrbit?: boolean;
        threeDOrbitSpeed?: number;
        threeDOrbitYaw?: number;
        threeDOrbitPitch?: number;
      })
      .filter((message) => message.type === EMBED_CONFIG_MESSAGE);
    expect(configMessages).toEqual([
      expect.objectContaining({
        type: EMBED_CONFIG_MESSAGE,
        threeDAutoOrbit: true,
        threeDOrbitSpeed: 30,
        threeDOrbitYaw: 12,
        threeDOrbitPitch: 2
      }),
      expect.objectContaining({
        type: EMBED_CONFIG_MESSAGE,
        threeDAutoOrbit: true,
        threeDOrbitSpeed: 30,
        threeDOrbitYaw: 30,
        threeDOrbitPitch: 2
      }),
      expect.objectContaining({
        type: EMBED_CONFIG_MESSAGE,
        threeDAutoOrbit: true,
        threeDOrbitSpeed: 30,
        threeDOrbitYaw: 30,
        threeDOrbitPitch: 8
      }),
      expect.objectContaining({
        type: EMBED_CONFIG_MESSAGE,
        threeDAutoOrbit: false,
        threeDOrbitSpeed: 30,
        threeDOrbitYaw: 30,
        threeDOrbitPitch: 8
      })
    ]);
  });

  it('posts panorama animation config before file loads when file options provide it', async () => {
    document.body.innerHTML = '<div id="target"></div>';
    const controller = getPlenoview().create('#target', {
      height: 200
    });
    const iframe = getViewerIframe(controller.element);
    const postMessage = spyOnIframePostMessage(iframe);

    dispatchEmbedReady(controller.element, iframe);
    await controller.loadFile(new File(['pixels'], 'pano.exr'), {
      name: 'Local panorama',
      view: 'panorama',
      panoramaAutoRotate: true,
      panoramaRotationSpeed: -8
    });

    expect(getViewerIframe(controller.element)).toBe(iframe);
    expect(postMessage.mock.calls[0]?.[0]).toEqual({
      type: EMBED_CONFIG_MESSAGE,
      panoramaAutoRotate: true,
      panoramaRotationSpeed: -8,
      threeDAutoOrbit: false,
      threeDOrbitSpeed: 6,
      threeDOrbitYaw: 12,
      threeDOrbitPitch: 2
    });
    expect(postMessage.mock.calls[1]?.[0]).toMatchObject({
      type: EMBED_LOAD_FILE_MESSAGE,
      name: 'Local panorama',
      state: {
        viewerMode: 'panorama'
      }
    });
  });
});

function getPlenoview(): PlenoviewApiForTest {
  return (window as unknown as PlenoviewWindowForTest).Plenoview;
}

function getViewerIframe(element: HTMLElement): HTMLIFrameElement {
  const iframe = element.shadowRoot?.querySelector('iframe');
  expect(iframe).toBeInstanceOf(HTMLIFrameElement);
  return iframe as HTMLIFrameElement;
}

function dispatchEmbedReady(element: PlenoviewViewerElementForTest, iframe: HTMLIFrameElement): void {
  window.dispatchEvent(new MessageEvent('message', {
    source: iframe.contentWindow,
    origin: element.viewerOrigin,
    data: {
      type: EMBED_READY_MESSAGE
    }
  }));
}

function dispatchEmbedDeferredLoad(element: PlenoviewViewerElementForTest, iframe: HTMLIFrameElement): void {
  window.dispatchEvent(new MessageEvent('message', {
    source: iframe.contentWindow,
    origin: element.viewerOrigin,
    data: {
      type: EMBED_DEFERRED_LOAD_MESSAGE
    }
  }));
}

function spyOnIframePostMessage(iframe: HTMLIFrameElement) {
  if (!iframe.contentWindow) {
    throw new Error('Expected iframe.contentWindow to exist.');
  }
  return vi.spyOn(iframe.contentWindow, 'postMessage').mockImplementation(() => undefined);
}

function stubFetchOk() {
  const fetchMock = vi.fn<typeof fetch>(async () => {
    return {
      ok: true,
      blob: async () => new Blob([new Uint8Array([1, 2, 3])], {
        type: 'image/x-exr'
      })
    } as Response;
  });
  Object.defineProperty(window, 'fetch', {
    configurable: true,
    writable: true,
    value: fetchMock
  });
  return fetchMock;
}

function stubFetchNotFound() {
  const fetchMock = vi.fn<typeof fetch>(async () => {
    return {
      ok: false,
      status: 404
    } as Response;
  });
  Object.defineProperty(window, 'fetch', {
    configurable: true,
    writable: true,
    value: fetchMock
  });
  return fetchMock;
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
