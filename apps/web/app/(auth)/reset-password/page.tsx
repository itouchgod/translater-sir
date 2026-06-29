import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResetPasswordForm } from "./form";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    email?: string;
    token?: string;
  }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>重置密码</CardTitle>
        <CardDescription>设置一个新的登录密码。</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm email={params.email ?? ""} token={params.token ?? ""} />
      </CardContent>
    </Card>
  );
}
