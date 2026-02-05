import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/auth/user-menu";
import { ThemeSwitcher } from "@/components/theme-switcher";
import Link from "next/link";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-12 items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex gap-5 items-center font-semibold">
              <Link href="/" className="text-lg">
                Scenery
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <ThemeSwitcher />
              {user ? (
                <UserMenu user={user} />
              ) : (
                <Link
                  href="/auth/login"
                  className="text-sm font-medium hover:underline"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </nav>
        <div className="flex-1 flex flex-col gap-12 w-full max-w-5xl px-5">
          {children}
        </div>

        <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-8">
          <p className="text-muted-foreground">
            Scenery - Create videos from React components
          </p>
        </footer>
      </div>
    </main>
  );
}
