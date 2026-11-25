import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@busms/ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CheckoutReturnClient } from "@/components/checkout-return-client";

export const metadata: Metadata = {
  title: "Booking Confirmation | SafarLine",
  description: "Verify your payment status and download your QR boarding passes.",
};

export default function CheckoutReturnPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <Suspense fallback={<Skeleton className="mx-auto h-64 max-w-2xl" />}>
          <CheckoutReturnClient />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
