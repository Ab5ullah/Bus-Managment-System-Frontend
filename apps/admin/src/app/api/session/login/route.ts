import { ADMIN_PORTAL_ROLES } from "@busms/config/constants";
import { handleBffLogin } from "@busms/api-client/bff";

export async function POST(request: Request) {
  return handleBffLogin(request, { allowedRoles: ADMIN_PORTAL_ROLES });
}
