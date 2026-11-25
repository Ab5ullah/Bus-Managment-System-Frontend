import { OpsShell } from "@/components/ops-shell";
import { TripsSchedulerClient } from "@/components/trips-scheduler-client";

export default function TripsAdminPage() {
  return (
    <OpsShell>
      <TripsSchedulerClient />
    </OpsShell>
  );
}
