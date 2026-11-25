import en from "./messages/en.json";
import ur from "./messages/ur.json";
import type { AppLocale } from "../constants";

export const messages = {
  en,
  ur,
} as const;

export type Messages = typeof en;

export function getMessages(locale: AppLocale): Messages {
  return (messages[locale] ?? messages.en) as Messages;
}
