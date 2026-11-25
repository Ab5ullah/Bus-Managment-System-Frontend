import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { getMessages } from "@busms/config/i18n";
import type { AppLocale } from "@busms/config/constants";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: AppLocale = hasLocale(routing.locales, requested)
    ? (requested as AppLocale)
    : routing.defaultLocale;

  return {
    locale,
    messages: getMessages(locale),
  };
});
