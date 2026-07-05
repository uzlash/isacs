import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { ACCESS_COOKIE, isLive } from "@/lib/config";

// Layout for the operator console: guards the whole group behind a session
// (live mode only), loads data, and wraps every module view in the persistent
// sidebar + topbar chrome. The /login route lives outside this group.
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  if (isLive) {
    const session = await cookies();
    if (!session.get(ACCESS_COOKIE)?.value) {
      redirect("/login");
    }
  }

  return <AppShell>{children}</AppShell>;
}
