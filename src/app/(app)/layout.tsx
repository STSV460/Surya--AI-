import { auth } from "@/auth";
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
  let session;
  try {
    session = await auth();
  } catch (err) {
    // If auth() throws (Cloudflare Worker bundling issue, network failure, etc.),
    // log full stack and fall through to /login redirect instead of returning 500.
    console.error("[AppLayout] auth() threw:", err);
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
