import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { PLANS } from "@/lib/stripe";

export const GET = withApiHandler(async function GET() {
  return apiSuccess(PLANS);
});
