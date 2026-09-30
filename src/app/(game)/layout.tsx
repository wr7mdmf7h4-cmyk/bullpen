import { Logo } from "@/components/brand/logo";
import { DesktopNav, MobileTabBar } from "@/components/shell/nav-links";
import { UserMenu } from "@/components/shell/user-menu";
import { requireUser } from "@/server/users";

export default async function GameLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Logo href="/dashboard" />
          <DesktopNav username={user.username} />
          <div className="ml-auto flex items-center gap-3">
            <UserMenu username={user.username} avatarSeed={user.avatarSeed} isDemo={user.isDemo} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 sm:px-6 md:pb-16">{children}</main>
      <MobileTabBar username={user.username} />
    </div>
  );
}
