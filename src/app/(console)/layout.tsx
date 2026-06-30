import AppShell from "@/components/AppShell";

// Layout for the operator console: wraps every module view in the persistent
// sidebar + topbar chrome. The /login route lives outside this group, so it
// renders without the shell.
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
