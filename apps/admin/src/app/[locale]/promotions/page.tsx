import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { PromotionsClient } from "@/components/promotions-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("promo");
  return { title: t("title") };
}

export default function PromotionsPage() {
  return <PromotionsClient />;
}
