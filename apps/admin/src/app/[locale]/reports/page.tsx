import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { ReportsClient } from "@/components/reports-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reports");
  return { title: t("title") };
}

export default function ReportsPage() {
  return <ReportsClient />;
}
