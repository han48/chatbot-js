import { describe, it, expect } from 'vitest';

describe('Test setup verification', () => {
  it('vitest with jsdom environment works', () => {
    expect(typeof document).toBe('object');
    expect(typeof window).toBe('object');
  });

  it('fast-check is available', async () => {
    const fc = await import('fast-check');
    expect(fc).toBeDefined();
    expect(typeof fc.assert).toBe('function');
  });

  it('can import app.js with module.exports pattern', () => {
    const app = require('../app.js');
    expect(app.validateMessage).toBeDefined();
    expect(typeof app.validateMessage).toBe('function');
  });
});
