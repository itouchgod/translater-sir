import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function forbiddenResponse() {
  return new NextResponse(
    `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>403 Forbidden</title>
  </head>
  <body style="margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#0f172a;">
    <main style="min-height:100vh;display:grid;place-items:center;padding:24px;">
      <section style="max-width:420px;border:1px solid #e2e8f0;background:white;border-radius:8px;padding:28px;">
        <p style="margin:0 0 8px;color:#64748b;font-size:14px;">403</p>
        <h1 style="margin:0 0 12px;font-size:24px;">无权访问管理员后台</h1>
        <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6;">当前账号没有管理员权限，请返回首页或联系系统管理员。</p>
        <a href="/dashboard" style="display:inline-flex;align-items:center;height:36px;padding:0 14px;border-radius:6px;background:#0f172a;color:white;text-decoration:none;font-size:14px;">返回首页</a>
      </section>
    </main>
  </body>
</html>`,
    {
      status: 403,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );
}

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);

    return NextResponse.redirect(loginUrl);
  }

  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (token.role !== "ADMIN" && token.role !== "SUPER_ADMIN") {
      return forbiddenResponse();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
