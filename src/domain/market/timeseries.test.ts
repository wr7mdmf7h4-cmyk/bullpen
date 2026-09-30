import { describe, expect, it } from "vitest";
import { parseTimeSeries } from "./timeseries";

describe("parseTimeSeries", () => {
  it("stamps daily bars at the session close and converts dollars to cents", () => {
    const pts = parseTimeSeries([
      { datetime: "2026-09-29", close: "230.8500" },
      { datetime: "2026-11-27", close: "100.004" }, // Black Friday: 1pm close
    ]);
    expect(pts).toEqual([
      { t: Date.parse("2026-09-29T20:00:00Z"), p: 23085 },
      { t: Date.parse("2026-11-27T18:00:00Z"), p: 10000 },
    ]);
  });

  it("converts intraday New York times to UTC, ascending", () => {
    const pts = parseTimeSeries([
      { datetime: "2026-09-30 15:55:00", close: "231.10" },
      { datetime: "2026-09-30 09:30:00", close: "229.00" },
    ]);
    expect(pts.map((p) => new Date(p.t).toISOString())).toEqual([
      "2026-09-30T13:30:00.000Z",
      "2026-09-30T19:55:00.000Z",
    ]);
  });

  it("skips malformed rows", () => {
    expect(
      parseTimeSeries([
        { datetime: "nope", close: "1" },
        { datetime: "2026-09-29", close: "abc" },
      ]),
    ).toEqual([]);
  });
});
