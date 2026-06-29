import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TermList } from "@/components/dictionary/TermList";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

type DictionaryDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DictionaryDetailPage({ params }: DictionaryDetailPageProps) {
  const [{ id }, session] = await Promise.all([params, auth()]);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const dictionary = await db.dictionary.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          terms: true,
        },
      },
    },
  });

  if (!dictionary) {
    notFound();
  }

  await requirePermission(dictionary.organizationId, "dictionary:manage");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/dictionary" className="text-sm text-muted-foreground hover:text-foreground">
          返回企业词典
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-normal">{dictionary.name}</h1>
          {dictionary.isDefault ? <Badge>默认</Badge> : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {dictionary.description || "管理该术语库中的原文、译文和语言对。"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>术语列表</CardTitle>
          <CardDescription>当前共 {dictionary._count.terms} 条术语。</CardDescription>
        </CardHeader>
        <CardContent>
          <TermList dictionaryId={dictionary.id} />
        </CardContent>
      </Card>
    </div>
  );
}
