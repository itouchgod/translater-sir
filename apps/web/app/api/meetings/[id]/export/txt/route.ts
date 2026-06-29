import { withApiHandler } from "@/lib/api-handler";
import { handleSummaryExport } from "@/app/api/meetings/[id]/export/export-route";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const GET = withApiHandler(async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return handleSummaryExport(request, id, "txt");
});
