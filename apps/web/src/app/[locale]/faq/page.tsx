import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@busms/ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "FAQ | SafarLine",
  description: "Frequently asked questions on seat locks, boarding passes, and refunds.",
};

const FAQ_ITEMS = [
  {
    q: "How long are my selected seats held during checkout?",
    a: "Once you click Continue on the seat map, up to 6 seats are locked exclusively for your session for 10 minutes (600 seconds) while you enter passenger details and complete payment.",
  },
  {
    q: "How do Ladies-Only seats work?",
    a: "Seats marked with the Ladies-Only indicator (fuchsia) can only be assigned to passengers with gender set to FEMALE. Our booking engine validates this both in the form and on the server.",
  },
  {
    q: "What is the cancellation and refund policy?",
    a: "Cancellations more than 24 hours before departure receive a 90% fare refund; between 6 and 24 hours receive a 50% fare refund; less than 6 hours before departure are non-refundable (0%). The PKR 50 platform service fee is non-refundable except in operator emergency trip cancellations (100% refund).",
  },
  {
    q: "Do I need a printed ticket to board?",
    a: "No. After payment confirmation you receive an encrypted QR boarding pass and a downloadable PDF pass. Present the QR code on your phone to the conductor at the terminal gate.",
  },
  {
    q: "Can I cancel only one seat from a multi-seat booking?",
    a: "Yes. From your My Bookings portal, open the Cancellation Drawer and select the specific seats you wish to cancel without disturbing the rest of your party.",
  },
];

export default async function FaqPage() {
  const t = await getTranslations();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-10 sm:px-6">
        <div className="border-b pb-5">
          <h1 className="text-2xl font-semibold tracking-tight">{t("faqPage.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("faqPage.subtitle")}</p>
        </div>

        <div className="space-y-4">
          {FAQ_ITEMS.map((item) => (
            <Card key={item.q}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{item.q}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
