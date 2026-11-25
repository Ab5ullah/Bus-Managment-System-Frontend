import { ADMIN_PORTAL_ROLES } from "@busms/config/constants";
import { handleBffRefresh } from "@busms/api-client/bff";

export async function POST(request: Request) {
  return handleBffRefresh(request, { allowedRoles: ADMIN_PORTAL_ROLES });
}
