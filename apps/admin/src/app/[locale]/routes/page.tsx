import { OpsShell } from "@/components/ops-shell";
import { RoutesBuilderClient } from "@/components/routes-builder-client";

export default function RoutesAdminPage() {
  return (
    <OpsShell>
      <RoutesBuilderClient />
    </OpsShell>
  );
}
