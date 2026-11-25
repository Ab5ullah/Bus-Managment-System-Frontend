import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@busms/ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Terms & Refund Policy | SafarLine",
  description: "Terms of carriage, tax & service fee disclosures, and tiered cancellation rules.",
};

export default async function TermsPage() {
  const t = await getTranslations();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-10 sm:px-6">
        <div className="border-b pb-5">
          <h1 className="text-2xl font-semibold tracking-tight">{t("termsPage.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("termsPage.subtitle")}</p>
        </div>

        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">1. Fare, Tax & Platform Fee</CardTitle>
            </CardHeader>
            <CardContent>
              All ticket fares are denominated in Pakistani Rupees (PKR). Applicable 5% government tax and a fixed PKR 50 platform service fee are itemized at checkout directly from the central pricing engine.
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">2. Tiered Cancellation & Refund Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>• More than 24 hours prior to departure: 90% of ticket fare refunded.</p>
              <p>• 6 to 24 hours prior to departure: 50% of ticket fare refunded.</p>
              <p>• Under 6 hours prior to departure: 0% refund (no-show / late cancellation).</p>
              <p>• Operator Emergency Cancellation: 100% full refund including service fee.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">3. Terminal Check-In & Boarding</CardTitle>
            </CardHeader>
            <CardContent>
              Passengers must arrive at the departure terminal at least 20 minutes before scheduled departure with a valid CNIC and digital or printed QR boarding pass.
            </CardContent>
          </Card>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
