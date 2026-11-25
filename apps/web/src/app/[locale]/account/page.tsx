import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AccountPortalClient } from "@/components/account-portal-client";

export const metadata: Metadata = {
  title: "My Bookings & Account | SafarLine",
  description: "Manage reservations, QR boarding passes, saved passengers, and refunds.",
};

export default function AccountPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <AccountPortalClient />
      </main>
      <SiteFooter />
    </div>
  );
}
