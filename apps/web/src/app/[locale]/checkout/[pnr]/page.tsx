import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CheckoutPaymentClient } from "@/components/checkout-payment-client";

export const metadata: Metadata = {
  title: "Checkout Payment | SafarLine",
  description: "Complete your coach reservation securely via Stripe Checkout.",
};

export default async function CheckoutPnrPage({
  params,
}: {
  params: Promise<{ pnr: string }>;
}) {
  const { pnr } = await params;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <CheckoutPaymentClient pnr={pnr} />
      </main>
      <SiteFooter />
    </div>
  );
}
