import { describe, expect, it } from 'vitest';
import { createLossTracker, shouldWriteHeartbeat } from './liveness.ts';

describe('shouldWriteHeartbeat', () => {
  it('writes only when the gateway is ready and every watched server is available', () => {
    expect(shouldWriteHeartbeat(0, [true, true])).toBe(true);
    expect(shouldWriteHeartbeat(0, [])).toBe(true);
  });

  it('does not write while connecting, reconnecting or disconnected', () => {
    for (const status of [1, 2, 3, 4, 5]) expect(shouldWriteHeartbeat(status, [true])).toBe(false);
  });

  it('does not write while one watched server is unavailable', () => {
    expect(shouldWriteHeartbeat(0, [true, false])).toBe(false);
  });
});

describe('createLossTracker', () => {
  it('gives back the moment a server was lost, once', () => {
    const tracker = createLossTracker();
    tracker.markLost(['g1', 'g2'], 1000);
    expect(tracker.take('g1')).toBe(1000);
    expect(tracker.take('g1')).toBeUndefined();
    expect(tracker.take('g2')).toBe(1000);
  });

  it('keeps the earliest loss time', () => {
    const tracker = createLossTracker();
    tracker.markLost(['g1'], 1000);
    tracker.markLost(['g1'], 5000);
    expect(tracker.take('g1')).toBe(1000);
  });

  it('forgets everything on a resume', () => {
    const tracker = createLossTracker();
    tracker.markLost(['g1', 'g2'], 1000);
    tracker.clearAll();
    expect(tracker.take('g1')).toBeUndefined();
    expect(tracker.take('g2')).toBeUndefined();
  });

  it('does not report a server that was never lost', () => {
    expect(createLossTracker().take('g1')).toBeUndefined();
  });
});
