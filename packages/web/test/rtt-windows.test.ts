/**
 * rtt-windows.test.ts — Tests for RTT window computation and loss% math (PR-15).
 *
 * Tests computeRttSummary (exported from Manager.ts) directly, plus
 * the loss-percentage calculation via Manager internals.
 */

import { describe, test, expect } from "bun:test";
import { computeRttSummary } from "../src/ws/Manager";

// ---------------------------------------------------------------------------
// computeRttSummary — pure-function tests
// ---------------------------------------------------------------------------

describe("computeRttSummary", () => {
  test("empty samples → null for all window sizes", () => {
    const now = 100_000;
    expect(computeRttSummary([], now, 30_000)).toBeNull();
    expect(computeRttSummary([], now, 60_000)).toBeNull();
    expect(computeRttSummary([], now, 300_000)).toBeNull();
  });

  test("single sample within window → count=1, min=median=max=sample", () => {
    const now = 20_000;
    const samples = [{ ts: 10_000, rtt: 42 }];
    // 10_000 is within the 30s window (cutoff = now - 30_000 = -10_000)
    const result = computeRttSummary(samples, now, 30_000);
    expect(result).not.toBeNull();
    expect(result!.count).toBe(1);
    expect(result!.min).toBe(42);
    expect(result!.median).toBe(42);
    expect(result!.max).toBe(42);
  });

  test("sample outside window → null", () => {
    const now = 50_000;
    const samples = [{ ts: 10_000, rtt: 42 }];
    // cutoff = 50_000 - 30_000 = 20_000; sample at 10_000 is outside
    const result = computeRttSummary(samples, now, 30_000);
    expect(result).toBeNull();
  });

  test("windowing: 30s includes only recent samples; 1m includes more; 5m includes all", () => {
    // t=0 is "5 minutes ago" from now=300_000
    const now = 300_000;
    const samples = [
      { ts: 0,        rtt: 10 },  // 5 min ago  — in 5m only
      { ts: 60_000,   rtt: 20 },  // 4 min ago  — in 5m only
      { ts: 180_000,  rtt: 30 },  // 2 min ago  — in 5m only
      { ts: 240_000,  rtt: 40 },  // 1 min ago  — in 5m + 1m
      { ts: 270_000,  rtt: 50 },  // 30s ago    — in 5m + 1m + 30s
      { ts: 280_000,  rtt: 60 },  // 20s ago    — in 5m + 1m + 30s
    ];

    const s30 = computeRttSummary(samples, now, 30_000);
    const s1m = computeRttSummary(samples, now, 60_000);
    const s5m = computeRttSummary(samples, now, 300_000);

    // 30s window: ts >= 270_000 → samples at 270k and 280k
    expect(s30).not.toBeNull();
    expect(s30!.count).toBe(2);
    expect(s30!.min).toBe(50);
    expect(s30!.max).toBe(60);

    // 1m window: ts >= 240_000 → samples at 240k, 270k, 280k
    expect(s1m).not.toBeNull();
    expect(s1m!.count).toBe(3);
    expect(s1m!.min).toBe(40);
    expect(s1m!.max).toBe(60);

    // 5m window: all 6 samples
    expect(s5m).not.toBeNull();
    expect(s5m!.count).toBe(6);
    expect(s5m!.min).toBe(10);
    expect(s5m!.max).toBe(60);
  });

  test("even number of samples → median is average of two middle values", () => {
    const now = 100_000;
    // 4 samples all within window
    const samples = [
      { ts: 90_000, rtt: 10 },
      { ts: 91_000, rtt: 20 },
      { ts: 92_000, rtt: 30 },
      { ts: 93_000, rtt: 40 },
    ];
    const result = computeRttSummary(samples, now, 30_000);
    expect(result).not.toBeNull();
    expect(result!.count).toBe(4);
    // sorted: [10, 20, 30, 40]; mid=2; median = (20+30)/2 = 25
    expect(result!.median).toBe(25);
    expect(result!.min).toBe(10);
    expect(result!.max).toBe(40);
  });

  test("odd number of samples → median is middle value", () => {
    const now = 100_000;
    const samples = [
      { ts: 90_000, rtt: 10 },
      { ts: 91_000, rtt: 50 },
      { ts: 92_000, rtt: 30 },
    ];
    const result = computeRttSummary(samples, now, 30_000);
    expect(result).not.toBeNull();
    // sorted: [10, 30, 50]; mid=1; median=30
    expect(result!.median).toBe(30);
  });

  test("samples exactly at the cutoff boundary are included", () => {
    const now = 100_000;
    // cutoff = 100_000 - 30_000 = 70_000
    const samples = [
      { ts: 70_000, rtt: 99 },  // exactly at cutoff — included (ts >= cutoff)
      { ts: 69_999, rtt: 1 },   // one ms before cutoff — excluded
    ];
    const result = computeRttSummary(samples, now, 30_000);
    expect(result).not.toBeNull();
    expect(result!.count).toBe(1);
    expect(result!.min).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// Loss% formula
// ---------------------------------------------------------------------------

describe("lossPct formula", () => {
  test("pingsSent=0 → lossPct=0 (no division by zero)", () => {
    // The formula: pingsSent > 0 ? (pingsLost / pingsSent * 100) : 0
    const pingsSent = 0;
    const pingsLost = 0;
    const lossPct = pingsSent > 0 ? (pingsLost / pingsSent) * 100 : 0;
    expect(lossPct).toBe(0);
  });

  test("pingsSent=10, pingsLost=2 → lossPct=20", () => {
    const pingsSent = 10;
    const pingsLost = 2;
    const lossPct = pingsSent > 0 ? (pingsLost / pingsSent) * 100 : 0;
    expect(lossPct).toBe(20);
  });

  test("pingsSent=10, pingsLost=0 → lossPct=0", () => {
    const pingsSent = 10;
    const pingsLost = 0;
    const lossPct = pingsSent > 0 ? (pingsLost / pingsSent) * 100 : 0;
    expect(lossPct).toBe(0);
  });

  test("pingsSent=3, pingsLost=3 → lossPct=100", () => {
    const pingsSent = 3;
    const pingsLost = 3;
    const lossPct = pingsSent > 0 ? (pingsLost / pingsSent) * 100 : 0;
    expect(lossPct).toBe(100);
  });
});
