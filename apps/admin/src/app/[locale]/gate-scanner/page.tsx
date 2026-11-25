import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { GateScannerClient } from "@/components/gate-scanner-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("scanner");
  return { title: t("title") };
}

export default function GateScannerPage() {
  return <GateScannerClient />;
}
