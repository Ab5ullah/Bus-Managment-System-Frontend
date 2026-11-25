import { OpsShell } from "@/components/ops-shell";
import { FleetStudioClient } from "@/components/fleet-studio-client";

export default function FleetPage() {
  return (
    <OpsShell>
      <FleetStudioClient />
    </OpsShell>
  );
}
