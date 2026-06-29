import Papa from "papaparse";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { getDictionaryForAccess, invalidateGlossaryCache } from "@/lib/dictionaries";
import { ValidationError } from "@/lib/errors";
import { CreateTermSchema } from "@/lib/validations/dictionary";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type RawCsvTerm = {
  source?: string;
  target?: string;
  language?: string;
  notes?: string;
};

type ImportError = {
  row: number;
  message: string;
};

export const POST = withApiHandler(async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const dictionary = await getDictionaryForAccess(id);
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new ValidationError("请上传 CSV 文件");
  }

  const csv = await file.text();
  const parsed = Papa.parse<RawCsvTerm>(csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });
  const parseErrors: ImportError[] = parsed.errors.map((error) => ({
    row: (error.row ?? 0) + 2,
    message: error.message,
  }));
  const rows = parsed.data;
  const errors: ImportError[] = [...parseErrors];
  const validTerms = rows.flatMap((row, index) => {
    const parsedTerm = CreateTermSchema.safeParse({
      source: row.source,
      target: row.target,
      language: row.language,
      notes: row.notes,
    });

    if (!parsedTerm.success) {
      errors.push({
        row: index + 2,
        message: parsedTerm.error.issues[0]?.message ?? "术语格式无效",
      });
      return [];
    }

    return [
      {
        dictionaryId: dictionary.id,
        source: parsedTerm.data.source,
        target: parsedTerm.data.target,
        language: parsedTerm.data.language,
        notes: parsedTerm.data.notes,
      },
    ];
  });

  const result =
    validTerms.length > 0
      ? await db.dictionaryTerm.createMany({
          data: validTerms,
        })
      : { count: 0 };

  if (result.count > 0) {
    await invalidateGlossaryCache(dictionary.organizationId);
  }

  return apiSuccess({
    imported: result.count,
    failed: errors.length,
    errors,
  });
});
