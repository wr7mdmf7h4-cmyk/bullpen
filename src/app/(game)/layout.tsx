import { Logo } from "@/components/brand/logo";
import { DesktopNav, MobileTabBar } from "@/components/shell/nav-links";
import { UserMenu } from "@/components/shell/user-menu";
import { LeagueSwitcher } from "@/components/shell/league-switcher";
import { StockSearch } from "@/components/shell/stock-search";
import { getActivePortfolio, getMyPortfolios } from "@/server/leagues/active";
import { isAdmin } from "@/server/admin";
import { requireUser } from "@/server/users";

export default async function GameLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [active, portfolios] = await Promise.all([getActivePortfolio(user.id), getMyPortfolios(user.id)]);
  const leagues = portfolios.map(({ league }) => ({
    id: league.id,
    name: league.name,
    kind: league.kind,
  }));
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Logo href="/dashboard" className="[&>span]:hidden sm:[&>span]:inline" />
          <DesktopNav username={user.username} />
          <div className="ml-auto flex items-center gap-2">
            <StockSearch />
            <LeagueSwitcher leagues={leagues} activeId={active.leagueId} />
            <UserMenu username={user.username} avatarSeed={user.avatarSeed} isAdmin={isAdmin(user.email)} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 sm:px-6 md:pb-16">{children}</main>
      <MobileTabBar username={user.username} />
    </div>
  );
}
