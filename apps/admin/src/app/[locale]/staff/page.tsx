import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { OpsShell } from "@/components/ops-shell";
import { StaffManagementClient } from "@/components/staff-management-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("staff");
  return { title: t("title") };
}

export default function StaffPage() {
  return (
    <OpsShell>
      <StaffManagementClient />
    </OpsShell>
  );
}
