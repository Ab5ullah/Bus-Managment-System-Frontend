import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { OpsShell } from "@/components/ops-shell";
import { CounterPosClient } from "@/components/counter-pos-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pos");
  return { title: t("title") };
}

export default function CounterPosPage() {
  return (
    <OpsShell>
      <CounterPosClient />
    </OpsShell>
  );
}
