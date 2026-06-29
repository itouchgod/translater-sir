import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PasswordForm } from "@/components/user/PasswordForm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function SecuritySettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const loginLogs = await db.auditLog.findMany({
    where: {
      userId: session.user.id,
      action: "auth.login",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 5,
    select: {
      id: true,
      action: true,
      ip: true,
      userAgent: true,
      createdAt: true,
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">安全设置</h1>
        <p className="text-sm text-muted-foreground">修改密码并查看最近登录记录。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>修改密码</CardTitle>
          <CardDescription>修改密码前需要验证当前密码。</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>最近登录</CardTitle>
          <CardDescription>显示最近 5 次登录事件。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>事件</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>设备</TableHead>
                <TableHead className="text-right">时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loginLogs.length ? (
                loginLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="secondary">{log.action}</Badge>
                    </TableCell>
                    <TableCell>{log.ip ?? "-"}</TableCell>
                    <TableCell className="max-w-64 truncate">{log.userAgent ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      {log.createdAt.toLocaleString("zh-CN", {
                        hour12: false,
                      })}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="text-muted-foreground" colSpan={4}>
                    暂无登录记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
