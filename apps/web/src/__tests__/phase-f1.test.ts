import { describe, expect, it } from "vitest";
import { buildRouteSlug, formatDuration, parseRouteSlug, slugifyCity } from "../lib/public-api";

describe("Phase F1 public-api helpers", () => {
  it("builds and parses SEO route slugs cleanly", () => {
    expect(slugifyCity("Dera Ghazi Khan")).toBe("dera-ghazi-khan");
    const slug = buildRouteSlug("Lahore", "Islamabad");
    expect(slug).toBe("lahore-to-islamabad");
    expect(parseRouteSlug(slug)).toEqual({
      origin: "Lahore",
      destination: "Islamabad",
    });
    expect(parseRouteSlug("invalid-slug")).toBeNull();
  });

  it("formats durations cleanly", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(240)).toBe("4h");
    expect(formatDuration(260)).toBe("4h 20m");
  });
});
