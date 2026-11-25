import { describe, expect, it } from "vitest";
import { getMessages } from "@busms/config/i18n";
import { isRtlLocale } from "@busms/config/constants";
import { routing } from "../i18n/routing";

describe("apps/web i18n foundation", () => {
  it("supports en (LTR) and ur (RTL)", () => {
    expect(routing.locales).toEqual(["en", "ur"]);
    expect(isRtlLocale("en")).toBe(false);
    expect(isRtlLocale("ur")).toBe(true);

    const en = getMessages("en");
    const ur = getMessages("ur");
    expect(en.brand.name).toBe("SafarLine");
    expect(ur.brand.name).toBe("سفر لائن");
  });
});
