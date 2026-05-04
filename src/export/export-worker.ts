import { zipSync } from 'fflate';
import { createPngBytesFromPixels } from '../export-image';
import type { ExportImagePixels } from './export-pixels';
import type { PngCompressionLevel } from '../types';

interface EncodePngWorkerRequest {
  id: number;
  type: 'encodePng';
  pixels: ExportImagePixels;
  compressionLevel?: PngCompressionLevel;
}

interface ZipFilesWorkerRequest {
  id: number;
  type: 'zipFiles';
  files: Record<string, Uint8Array>;
}

type ExportWorkerRequest = EncodePngWorkerRequest | ZipFilesWorkerRequest;

type ExportWorkerResponse =
  | {
      id: number;
      ok: true;
      bytes: Uint8Array;
    }
  | {
      id: number;
      ok: false;
      error: string;
    };

type ExportWorkerScope = {
  addEventListener: (type: 'message', listener: (event: MessageEvent<ExportWorkerRequest>) => void) => void;
  postMessage: (message: ExportWorkerResponse, transfer?: Transferable[]) => void;
};

const worker = self as unknown as ExportWorkerScope;

worker.addEventListener('message', (event: MessageEvent<ExportWorkerRequest>) => {
  const request = event.data;
  try {
    const bytes = request.type === 'encodePng'
      ? createPngBytesFromPixels(request.pixels, { compressionLevel: request.compressionLevel })
      : zipSync(request.files);

    worker.postMessage({
      id: request.id,
      ok: true,
      bytes
    }, collectUint8ArrayTransferables(bytes));
  } catch (error) {
    worker.postMessage({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : 'Export worker failed.'
    });
  }
});

function collectUint8ArrayTransferables(bytes: Uint8Array): Transferable[] {
  return bytes.buffer instanceof ArrayBuffer ? [bytes.buffer] : [];
}
