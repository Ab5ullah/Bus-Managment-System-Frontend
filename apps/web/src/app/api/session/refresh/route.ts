import { handleBffRefresh } from "@busms/api-client/bff";

export async function POST(request: Request) {
  return handleBffRefresh(request);
}
