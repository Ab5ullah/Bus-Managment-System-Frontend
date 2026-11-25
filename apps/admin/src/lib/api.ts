"use client";

import { useMemo } from "react";
import { createBusmsApiClient } from "@busms/api-client";
import { useAuth } from "@busms/api-client/auth";

export function useApiClient() {
  const { getValidAccessToken, refreshSession } = useAuth();

  return useMemo(
    () =>
      createBusmsApiClient({
        getAccessToken: getValidAccessToken,
        onUnauthorized: refreshSession,
      }),
    [getValidAccessToken, refreshSession]
  );
}
