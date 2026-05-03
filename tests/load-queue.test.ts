import { describe, expect, it } from 'vitest';
import { LoadQueueService } from '../src/services/load-queue';

describe('load queue service', () => {
  it('runs queued tasks strictly in enqueue order', async () => {
    const queue = new LoadQueueService();
    const events: string[] = [];

    const first = queue.enqueue(async () => {
      events.push('first:start');
      await Promise.resolve();
      events.push('first:end');
    });
    const second = queue.enqueue(async () => {
      events.push('second:start');
      events.push('second:end');
    });
    const third = queue.enqueue(async () => {
      events.push('third:start');
      events.push('third:end');
    });

    await Promise.all([first, second, third]);

    expect(events).toEqual([
      'first:start',
      'first:end',
      'second:start',
      'second:end',
      'third:start',
      'third:end'
    ]);
  });

  it('continues with later tasks after an earlier task rejects', async () => {
    const queue = new LoadQueueService();
    const events: string[] = [];

    const first = queue.enqueue(async () => {
      events.push('first');
    });
    const second = queue.enqueue(async () => {
      events.push('second');
      throw new Error('boom');
    });
    const third = queue.enqueue(async () => {
      events.push('third');
    });

    await expect(first).resolves.toBeUndefined();
    await expect(second).rejects.toThrow('boom');
    await expect(third).resolves.toBeUndefined();
    expect(events).toEqual(['first', 'second', 'third']);
  });

  it('runs tasks up to the configured worker limit', async () => {
    const queue = new LoadQueueService({ maxWorkers: 2 });
    const events: string[] = [];
    let releaseFirst!: () => void;
    let releaseSecond!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const secondGate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });

    const first = queue.enqueue(async () => {
      events.push('first:start');
      await firstGate;
      events.push('first:end');
    });
    const second = queue.enqueue(async () => {
      events.push('second:start');
      await secondGate;
      events.push('second:end');
    });
    const third = queue.enqueue(async () => {
      events.push('third');
    });

    await Promise.resolve();
    expect(events).toEqual(['first:start', 'second:start']);

    releaseSecond();
    await Promise.resolve();
    await second;
    expect(events).toEqual(['first:start', 'second:start', 'second:end', 'third']);

    releaseFirst();
    await Promise.all([first, third]);
    expect(events).toEqual(['first:start', 'second:start', 'second:end', 'third', 'first:end']);
  });

  it('starts queued work when the worker limit increases', async () => {
    const queue = new LoadQueueService({ maxWorkers: 1 });
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = queue.enqueue(async () => {
      events.push('first');
      await firstGate;
    });
    const second = queue.enqueue(async () => {
      events.push('second');
    });

    await Promise.resolve();
    expect(events).toEqual(['first']);

    queue.setMaxWorkers(2);
    await second;
    expect(events).toEqual(['first', 'second']);

    releaseFirst();
    await first;
  });

  it('does not abort active work when the worker limit decreases', async () => {
    const queue = new LoadQueueService({ maxWorkers: 2 });
    const events: string[] = [];
    let releaseFirst!: () => void;
    let releaseSecond!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const secondGate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });

    const first = queue.enqueue(async (signal) => {
      events.push(`first:${signal.aborted}`);
      await firstGate;
    });
    const second = queue.enqueue(async (signal) => {
      events.push(`second:${signal.aborted}`);
      await secondGate;
    });
    const third = queue.enqueue(async () => {
      events.push('third');
    });

    await Promise.resolve();
    queue.setMaxWorkers(1);
    await Promise.resolve();
    expect(events).toEqual(['first:false', 'second:false']);

    releaseFirst();
    releaseSecond();
    await Promise.all([first, second, third]);
    expect(events).toEqual(['first:false', 'second:false', 'third']);
  });

  it('aborts the active task signal and rejects queued tasks after dispose', async () => {
    const queue = new LoadQueueService();
    let activeSignal: AbortSignal | null = null;
    let markFirstStarted!: () => void;
    let releaseFirst!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = queue.enqueue(async (signal) => {
      activeSignal = signal;
      markFirstStarted();
      await firstGate;
    });
    await firstStarted;

    const second = queue.enqueue(async () => {
      throw new Error('should not run');
    });

    queue.dispose();
    releaseFirst();

    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await expect(second).rejects.toMatchObject({ name: 'AbortError' });
    expect(activeSignal).not.toBeNull();
    expect(activeSignal!.aborted).toBe(true);
  });

  it('prioritizes foreground tasks ahead of queued background tasks', async () => {
    const queue = new LoadQueueService();
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = queue.enqueue(async () => {
      events.push('first');
      await firstGate;
    }, { priority: 'background' });
    const background = queue.enqueue(async () => {
      events.push('background');
    }, { priority: 'background' });
    const foreground = queue.enqueue(async () => {
      events.push('foreground');
    }, { priority: 'foreground' });

    await Promise.resolve();
    releaseFirst();
    await Promise.all([first, background, foreground]);

    expect(events).toEqual(['first', 'foreground', 'background']);
  });

  it('cancels queued and active matching tasks', async () => {
    const queue = new LoadQueueService();
    let activeSignal: AbortSignal | null = null;
    let markFirstStarted!: () => void;
    let releaseFirst!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = queue.enqueue(async (signal) => {
      activeSignal = signal;
      markFirstStarted();
      await firstGate;
    }, { priority: 'background', category: 'folder' });
    await firstStarted;

    const second = queue.enqueue(async () => {
      throw new Error('should not run');
    }, { priority: 'background', category: 'folder' });

    queue.cancelWhere((entry) => entry.category === 'folder', 'Folder work was cancelled.');
    releaseFirst();

    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await expect(second).rejects.toMatchObject({ name: 'AbortError' });
    expect(activeSignal).not.toBeNull();
    expect(activeSignal!.aborted).toBe(true);
  });
});
