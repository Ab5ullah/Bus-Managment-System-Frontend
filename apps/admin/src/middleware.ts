import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_PORTAL_ROLES,
  DEFAULT_LOCALE,
  LOCALES,
  canRoleAccessAdminPath,
  getDefaultRouteForRole,
} from "@busms/config/constants";
import { extractRoleFromJwt, isJwtExpired } from "@busms/api-client/auth";
import { REFRESH_COOKIE_NAME } from "@busms/api-client/bff";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

function resolveLocaleAndPath(pathname: string): { locale: string; strippedPath: string } {
  const match = pathname.match(/^\/(en|ur)(\/.*)?$/);
  if (match && match[1]) {
    return {
      locale: match[1],
      strippedPath: match[2] || "/",
    };
  }
  return {
    locale: DEFAULT_LOCALE,
    strippedPath: pathname || "/",
  };
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let next-intl normalize root "/" -> "/en" or "/ur" first
  const hasLocalePrefix = LOCALES.some(
    (loc) => pathname === `/${loc}` || pathname.startsWith(`/${loc}/`)
  );
  if (!hasLocalePrefix) {
    return intlMiddleware(request);
  }

  const { locale, strippedPath } = resolveLocaleAndPath(pathname);
  const refreshCookie = request.cookies.get(REFRESH_COOKIE_NAME)?.value;
  const hasValidToken = Boolean(refreshCookie && !isJwtExpired(refreshCookie, 5));
  const role = hasValidToken ? extractRoleFromJwt(refreshCookie) : null;
  const isAdminRole = Boolean(
    role && (ADMIN_PORTAL_ROLES as readonly string[]).includes(role)
  );

  // Public auth entry routes inside admin portal
  if (strippedPath === "/login" || strippedPath === "/unauthorized") {
    if (strippedPath === "/login" && hasValidToken && isAdminRole) {
      const target = getDefaultRouteForRole(role);
      return NextResponse.redirect(new URL(`/${locale}${target === "/" ? "" : target}`, request.url));
    }
    return intlMiddleware(request);
  }

  // Protected operations routes require active refresh cookie + valid ops role
  if (!hasValidToken || !isAdminRole) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("next", strippedPath);
    if (hasValidToken && !isAdminRole) {
      loginUrl.searchParams.set("error", "unauthorized");
    }
    return NextResponse.redirect(loginUrl);
  }

  // Enforce per-role section access (e.g. COUNTER_AGENT -> /counter-pos, CONDUCTOR -> /gate-scanner)
  if (!canRoleAccessAdminPath(role, pathname)) {
    const fallback = getDefaultRouteForRole(role);
    return NextResponse.redirect(
      new URL(`/${locale}${fallback === "/" ? "" : fallback}`, request.url)
    );
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
