import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@busms/ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Contact & Support | SafarLine",
  description: "24/7 passenger helpdesk and central dispatch contact information.",
};

export default async function ContactPage() {
  const t = await getTranslations();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-10 sm:px-6">
        <div className="border-b pb-5">
          <h1 className="text-2xl font-semibold tracking-tight">{t("contactPage.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("contactPage.subtitle")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Phone className="h-4 w-4 text-primary" />
                <span>24/7 Dispatch Hotline</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p className="font-mono text-base font-semibold text-foreground">+92 (42) 111-723-270</p>
              <p>Immediate PNR assistance, terminal directions, and schedule updates.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4 text-primary" />
                <span>Passenger Support Email</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p className="font-mono text-base font-semibold text-foreground">support@safarline.pk</p>
              <p>Refund inquiries, corporate group bookings, and lost-item reports.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-primary" />
                <span>Central Operations Hub</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Thokar Niaz Baig Main Motorway Terminal, Lahore, Punjab, Pakistan
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-primary" />
                <span>Terminal Counter Hours</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Open 24 hours daily across all M1 / M2 motorway hubs for walk-in ticketing and boarding.
            </CardContent>
          </Card>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
