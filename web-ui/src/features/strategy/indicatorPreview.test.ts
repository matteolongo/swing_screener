import { describe, expect, it } from 'vitest';
import { buildIndicatorPreviewViewModel } from '@/features/strategy/indicatorPreview';

describe('indicatorPreview', () => {
  it('builds a valid deterministic preview for typical windows', () => {
    const model = buildIndicatorPreviewViewModel({
      breakoutLookback: 50,
      pullbackMa: 20,
      smaFast: 20,
      smaMid: 50,
      smaLong: 200,
    });

    expect(model.isValid).toBe(true);
    expect(model.points.length).toBeGreaterThan(100);
    expect(model.latestClose).toBeGreaterThan(0);
    expect(model.latestBreakoutHigh).toBeGreaterThan(0);
    expect(model.latestPullbackMa).toBeGreaterThan(0);
  });

  it('returns invalid model for non-positive windows', () => {
    const model = buildIndicatorPreviewViewModel({
      breakoutLookback: 0,
      pullbackMa: 20,
      smaFast: 20,
      smaMid: 50,
      smaLong: 200,
    });

    expect(model.isValid).toBe(false);
    expect(model.errorMessage).toContain('positive integers');
    expect(model.points).toHaveLength(0);
  });

  it('returns invalid model for oversized windows', () => {
    const model = buildIndicatorPreviewViewModel({
      breakoutLookback: 300,
      pullbackMa: 20,
      smaFast: 20,
      smaMid: 50,
      smaLong: 200,
    });

    expect(model.isValid).toBe(false);
    expect(model.errorMessage).toContain('below');
  });
});
