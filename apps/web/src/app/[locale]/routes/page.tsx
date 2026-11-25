import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RoutesDirectoryClient } from "@/components/routes-directory-client";
import { fetchRoutes } from "@/lib/public-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Intercity Bus Routes | SafarLine",
  description: "Browse scheduled motorway and intercity bus corridors across Pakistan.",
};

export default async function RoutesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations();
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const pageSize = Number(sp.page_size) || 12;
  const search = typeof sp.search === "string" ? sp.search : "";

  const data = await fetchRoutes({ page, pageSize, search });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-10 sm:px-6">
        <div className="border-b pb-5">
          <h1 className="text-2xl font-semibold tracking-tight">{t("routesPage.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("routesPage.subtitle")}</p>
        </div>

        <RoutesDirectoryClient initialData={data} initialSearch={search} />
      </main>

      <SiteFooter />
    </div>
  );
}
