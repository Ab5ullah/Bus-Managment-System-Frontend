import Link from "next/link";

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background p-6 font-sans text-foreground">
        <div className="max-w-md space-y-4 rounded-xl border bg-card p-6 text-center shadow-panel">
          <h1 className="text-xl font-semibold">Page Not Found</h1>
          <p className="text-sm text-muted-foreground">
            The route or page you requested could not be found.
          </p>
          <Link
            href="/en"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to Home
          </Link>
        </div>
      </body>
    </html>
  );
}
