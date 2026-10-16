import { describe, it, expect } from "vitest";
import { parseNairaToKobo, formatKobo, percentOfBps, splitDeposit, lineTotal } from "../src/lib/money";

describe("parseNairaToKobo", () => {
  it.each([["1500", 150000n], ["₦1,500", 150000n], ["1500.5", 150050n], ["1 500.05", 150005n], ["0.01", 1n]])(
    "%s -> %s", (s, k) => expect(parseNairaToKobo(s)).toEqual({ ok: true, kobo: k }));
  it("avoids the float trap 0.1+0.2 style: 19.99 is exactly 1999 kobo", () => {
    expect(parseNairaToKobo("19.99")).toEqual({ ok: true, kobo: 1999n });
  });
  it.each(["", "  ", "abc", "-5", "0", "0.00", "1.234", "1e3", "NaN", "₦", "1,5,0.00x", "100000001"])(
    "rejects %j", (s) => expect(parseNairaToKobo(s).ok).toBe(false));
  it("rejects null/undefined/objects", () => {
    for (const v of [null, undefined, {}, []]) expect(parseNairaToKobo(v).ok).toBe(false);
  });
});

describe("formatKobo", () => {
  it.each([[0n, "₦0.00"], [5n, "₦0.05"], [150000n, "₦1,500.00"], [123456789n, "₦1,234,567.89"]])(
    "%s -> %s", (k, s) => expect(formatKobo(k)).toBe(s));
  it("never prints NGN", () => expect(formatKobo(100n)).not.toContain("NGN"));
});

describe("percent and deposit (hand-computed)", () => {
  it("70% of ₦1,000.00 = ₦700.00", () => expect(percentOfBps(100000n, 7000)).toBe(70000n));
  it("rounds half up: 70% of 5 kobo = 3.5 -> 4", () => expect(percentOfBps(5n, 7000)).toBe(4n));
  it("70% of 1 kobo = 0.7 -> 1", () => expect(percentOfBps(1n, 7000)).toBe(1n));
  it("deposit + balance always equals total (odd amounts)", () => {
    for (const t of [1n, 3n, 99n, 12345n, 150001n, 9999999n]) {
      const { deposit, balance } = splitDeposit(t);
      expect(deposit + balance).toBe(t);
    }
  });
  it("₦12,345.67 -> deposit 864197 (8641.969 rounds up), balance 370370", () => {
    expect(splitDeposit(1234567n)).toEqual({ deposit: 864197n, balance: 370370n });
  });
  it("rejects bad bps", () => { expect(() => percentOfBps(1n, 10001)).toThrow(); expect(() => percentOfBps(1n, 1.5)).toThrow(); });
  it("lineTotal", () => { expect(lineTotal(150000n, 3)).toBe(450000n); expect(() => lineTotal(1n, 0)).toThrow(); expect(() => lineTotal(1n, 1.5)).toThrow(); });
});
