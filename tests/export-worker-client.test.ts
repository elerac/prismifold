import { afterEach, describe, expect, it, vi } from 'vitest';
import { unzipSync } from 'fflate';
import {
  disposeExportWorker,
  encodePngOffMainThread,
  zipFilesOffMainThread
} from '../src/export/export-worker-client';

type WorkerEventMap = {
  message: Array<(event: MessageEvent) => void>;
  error: Array<(event: ErrorEvent) => void>;
  messageerror: Array<() => void>;
};

class WorkerMock {
  readonly listeners: WorkerEventMap = {
    message: [],
    error: [],
    messageerror: []
  };
  readonly postMessage = vi.fn();
  readonly terminate = vi.fn();

  addEventListener(type: keyof WorkerEventMap, listener: WorkerEventMap[keyof WorkerEventMap][number]): void {
    this.listeners[type].push(listener as never);
  }

  removeEventListener(type: keyof WorkerEventMap, listener: WorkerEventMap[keyof WorkerEventMap][number]): void {
    this.listeners[type] = this.listeners[type].filter((entry) => entry !== listener) as never;
  }

  emitMessage(data: unknown): void {
    for (const listener of this.listeners.message) {
      listener({ data } as MessageEvent);
    }
  }

  emitError(message = 'worker failed'): void {
    for (const listener of this.listeners.error) {
      listener({ message } as ErrorEvent);
    }
  }
}

afterEach(() => {
  disposeExportWorker();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('export worker client', () => {
  it('encodes PNG bytes in a worker and transfers the pixel buffer', async () => {
    const workers = installWorkerMock();
    const pixels = createPixels();
    const encodedBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const pending = encodePngOffMainThread(pixels, { compressionLevel: 7 });

    expect(workers).toHaveLength(1);
    expect(workers[0]?.postMessage).toHaveBeenCalledTimes(1);
    const [request, transferables] = workers[0]?.postMessage.mock.calls[0] ?? [];
    expect(request).toMatchObject({
      type: 'encodePng',
      compressionLevel: 7,
      pixels: {
        width: 1,
        height: 1
      }
    });
    expect(transferables).toEqual([pixels.data.buffer]);

    workers[0]?.emitMessage({
      id: (request as { id: number }).id,
      ok: true,
      bytes: encodedBytes
    });

    await expect(pending).resolves.toEqual(encodedBytes);
  });

  it('packages ZIP bytes in a worker and transfers file buffers', async () => {
    const workers = installWorkerMock();
    const first = new Uint8Array([1, 2, 3]);
    const second = new Uint8Array([4, 5, 6]);
    const zippedBytes = new Uint8Array([7, 8, 9]);
    const pending = zipFilesOffMainThread({
      'first.png': first,
      'second.png': second
    });

    expect(workers).toHaveLength(1);
    const [request, transferables] = workers[0]?.postMessage.mock.calls[0] ?? [];
    expect(request).toMatchObject({
      type: 'zipFiles',
      files: {
        'first.png': first,
        'second.png': second
      }
    });
    expect(transferables).toEqual([first.buffer, second.buffer]);

    workers[0]?.emitMessage({
      id: (request as { id: number }).id,
      ok: true,
      bytes: zippedBytes
    });

    await expect(pending).resolves.toEqual(zippedBytes);
  });

  it('falls back to main-thread PNG and ZIP work when workers are unavailable', async () => {
    vi.stubGlobal('Worker', undefined);

    const pngBytes = await encodePngOffMainThread(createPixels(), { compressionLevel: 0 });
    expect(Array.from(pngBytes.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const zipBytes = await zipFilesOffMainThread({
      'image.png': new Uint8Array([1, 2, 3])
    });
    const entries = unzipSync(zipBytes);
    expect(entries['image.png']).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('removes queued work when its signal aborts before the worker starts it', async () => {
    const workers = installWorkerMock();
    const first = encodePngOffMainThread(createPixels());
    const abortController = new AbortController();
    const second = encodePngOffMainThread(createPixels(), { signal: abortController.signal });

    expect(workers[0]?.postMessage).toHaveBeenCalledTimes(1);
    abortController.abort();

    await expect(second).rejects.toMatchObject({ name: 'AbortError' });
    expect(workers[0]?.postMessage).toHaveBeenCalledTimes(1);

    const request = workers[0]?.postMessage.mock.calls[0]?.[0] as { id: number };
    workers[0]?.emitMessage({
      id: request.id,
      ok: true,
      bytes: new Uint8Array([1])
    });
    await expect(first).resolves.toEqual(new Uint8Array([1]));
  });

  it('terminates active worker work on abort and recreates the worker for the next task', async () => {
    const workers = installWorkerMock();
    const abortController = new AbortController();
    const first = encodePngOffMainThread(createPixels(), { signal: abortController.signal });
    const second = encodePngOffMainThread(createPixels());

    abortController.abort();

    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    expect(workers[0]?.terminate).toHaveBeenCalledTimes(1);
    expect(workers).toHaveLength(2);
    expect(workers[1]?.postMessage).toHaveBeenCalledTimes(1);

    const request = workers[1]?.postMessage.mock.calls[0]?.[0] as { id: number };
    workers[1]?.emitMessage({
      id: request.id,
      ok: true,
      bytes: new Uint8Array([2])
    });
    await expect(second).resolves.toEqual(new Uint8Array([2]));
  });

  it('rejects active work when the worker reports an error', async () => {
    const workers = installWorkerMock();
    const pending = encodePngOffMainThread(createPixels());

    workers[0]?.emitError('encode failed');

    await expect(pending).rejects.toThrow('encode failed');
    expect(workers[0]?.terminate).toHaveBeenCalledTimes(1);
  });

  it('rejects pending work on dispose and creates a fresh worker later', async () => {
    const workers = installWorkerMock();
    const first = encodePngOffMainThread(createPixels());
    const second = encodePngOffMainThread(createPixels());

    disposeExportWorker();

    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await expect(second).rejects.toMatchObject({ name: 'AbortError' });
    expect(workers[0]?.terminate).toHaveBeenCalledTimes(1);

    const next = encodePngOffMainThread(createPixels());
    expect(workers).toHaveLength(2);
    const request = workers[1]?.postMessage.mock.calls[0]?.[0] as { id: number };
    workers[1]?.emitMessage({
      id: request.id,
      ok: true,
      bytes: new Uint8Array([3])
    });
    await expect(next).resolves.toEqual(new Uint8Array([3]));
  });
});

function installWorkerMock(): WorkerMock[] {
  const workers: WorkerMock[] = [];
  vi.stubGlobal(
    'Worker',
    class extends WorkerMock {
      constructor(..._args: unknown[]) {
        super();
        workers.push(this);
      }
    } as unknown as typeof Worker
  );
  return workers;
}

function createPixels() {
  return {
    width: 1,
    height: 1,
    data: new Uint8ClampedArray([1, 2, 3, 255])
  };
}
