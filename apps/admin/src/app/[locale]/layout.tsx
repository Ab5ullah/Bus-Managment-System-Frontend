import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "@busms/config/i18n";
import { isRtlLocale, type AppLocale } from "@busms/config/constants";
import { QueryProvider } from "@busms/api-client";
import { AuthProvider } from "@busms/api-client/auth";
import { routing } from "@/i18n/routing";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SafarLine Operations Console",
  description: "Bus Fleet, Route Corridors, Counter POS, Conductor Boarding, and BI Reports.",
};

export default async function AdminLocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const typedLocale = locale as AppLocale;
  const messages = getMessages(typedLocale);
  const dir = isRtlLocale(typedLocale) ? "rtl" : "ltr";

  return (
    <html
      lang={typedLocale}
      dir={dir}
      className={`${fontSans.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen font-sans">
        <NextIntlClientProvider locale={typedLocale} messages={messages}>
          <QueryProvider>
            <AuthProvider>{children}</AuthProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
