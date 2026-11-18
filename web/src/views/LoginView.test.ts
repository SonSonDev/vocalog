import { describe, expect, it } from 'vitest';
import { messageFor } from './LoginView.tsx';

describe('messageFor', () => {
  it('gives the fixed message of a known error code', () => {
    expect(messageFor('refus')).toContain('refusée');
  });

  it('gives nothing for a missing code', () => {
    expect(messageFor(null)).toBeUndefined();
  });

  it('gives nothing for an unknown or crafted code, including inherited object keys', () => {
    for (const reason of ['<script>', 'constructor', '__proto__', 'toString', 'hasOwnProperty']) expect(messageFor(reason)).toBeUndefined();
  });
});
