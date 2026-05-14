import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { UserHydrator } from "@/components/layout/UserHydrator";
import type { User } from "@/types/user";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Dynamic import + try/catch around BOTH the import AND the call so
  // OpenNext/Cloudflare bundling errors during module evaluation don't
  // bubble up as a generic 500. Falls through to /login on any failure
  // and logs the real stack to wrangler logs.
  let session: Awaited<ReturnType<typeof import("@/auth").auth>> | null = null;
  try {
    const { auth } = await import("@/auth");
    session = await auth();
  } catch (err) {
    console.error("[AppLayout] auth import or call threw:", err);
    redirect("/login");
  }

  if (!session?.user) {
    redirect("/login");
  }

  // Build a minimal User object from session for client-side hydration
  const sessionUser: User = {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    avatar: session.user.image ?? undefined,
    plan: "free",
    credits: 0,
    createdAt: new Date().toISOString(),
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <UserHydrator user={sessionUser} />
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <main className="flex flex-col flex-1 overflow-hidden relative">{children}</main>
        <MobileNav />
      </div>
    </div>
  );
}
