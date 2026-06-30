import { BrandMark } from "@/components/brand/BrandMark";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full flex-col items-center gap-6">
        <div className="flex items-center gap-3">
          <BrandMark size={48} className="size-12" />
          <span className="text-xl font-semibold tracking-normal">Translater Sir</span>
        </div>
        {children}
      </div>
    </main>
  );
}
