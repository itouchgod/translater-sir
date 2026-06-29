import type { DictionaryTerm } from "@prisma/client";
import { getDictionaryForAccess, getExportFileName } from "@/lib/dictionaries";
import { db } from "@/lib/db";
import { withApiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function escapeCsvCell(value: string | null) {
  const text = value ?? "";

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function toCsvRow(values: string[]) {
  return `${values.map(escapeCsvCell).join(",")}\n`;
}

export const GET = withApiHandler(async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const dictionary = await getDictionaryForAccess(id);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(toCsvRow(["source", "target", "language", "notes"])));

      let cursor: string | null = null;

      try {
        for (;;) {
          const terms: DictionaryTerm[] = await db.dictionaryTerm.findMany({
            where: { dictionaryId: dictionary.id },
            orderBy: [{ source: "asc" }, { id: "asc" }],
            ...(cursor
              ? {
                  cursor: { id: cursor },
                  skip: 1,
                }
              : {}),
            take: 500,
          });

          if (terms.length === 0) {
            break;
          }

          for (const term of terms) {
            controller.enqueue(
              encoder.encode(toCsvRow([term.source, term.target, term.language, term.notes ?? ""])),
            );
          }

          cursor = terms.at(-1)?.id ?? null;
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
  const fileName = getExportFileName(dictionary.name);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
});
