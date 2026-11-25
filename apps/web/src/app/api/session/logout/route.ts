import { handleBffLogout } from "@busms/api-client/bff";

export async function POST(request: Request) {
  return handleBffLogout(request);
}
