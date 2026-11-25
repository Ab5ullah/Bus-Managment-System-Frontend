import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SeatBookingFlow } from "@/components/seat-booking-flow";

export const metadata: Metadata = {
  title: "Select Seats & Checkout | SafarLine",
  description: "Choose your coach seats with live segment availability and 10-minute checkout lock.",
};

export default async function TripSeatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tripId } = await params;
  const sp = await searchParams;
  const fromStopId = typeof sp.from_stop === "string" ? sp.from_stop : "";
  const toStopId = typeof sp.to_stop === "string" ? sp.to_stop : "";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <SeatBookingFlow tripId={tripId} fromStopId={fromStopId} toStopId={toStopId} />
      </main>
      <SiteFooter />
    </div>
  );
}
