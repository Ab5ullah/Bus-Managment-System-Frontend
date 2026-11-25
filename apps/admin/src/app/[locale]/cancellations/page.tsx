import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { CancellationsClient } from "@/components/cancellations-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminCancel");
  return { title: t("title") };
}

export default function CancellationsPage() {
  return <CancellationsClient />;
}
