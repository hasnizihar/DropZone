import { describe, it, expect } from 'vitest';
import { THEME_COLORS, JOB_STATUS_LIST } from '@dropzone/shared';

describe('Design Tokens & Brand Specs', () => {
  it('enforces exact DROPZONE brand palette tokens', () => {
    expect(THEME_COLORS.nearBlack.toUpperCase()).toBe('#121417');
    expect(THEME_COLORS.warmOffWhite.toUpperCase()).toBe('#F5F3EF');
    expect(THEME_COLORS.acidLime.toUpperCase()).toBe('#D4FF5C');
    expect(THEME_COLORS.graphiteGrey.toUpperCase()).toBe('#858B93');
  });

  it('contains all mandatory job state machine statuses', () => {
    const requiredStatuses = [
      'pending',
      'analyzing',
      'ready',
      'downloading',
      'paused',
      'completed',
      'failed',
      'cancelled',
    ];
    for (const status of requiredStatuses) {
      expect(JOB_STATUS_LIST).toContain(status);
    }
  });
});

