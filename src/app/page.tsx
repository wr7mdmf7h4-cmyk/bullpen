import Link from "next/link";
import { ArrowRight, BarChart3, Medal, Receipt, Smartphone, Trophy, Users } from "lucide-react";
import { DemoButton } from "@/components/auth/auth-forms";
import { Logo } from "@/components/brand/logo";
import { FadeIn } from "@/components/landing/fade-in";
import { TickerTape } from "@/components/landing/ticker-tape";
import { Sparkline } from "@/components/market/sparkline";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { simulatedHistory, simulatedQuote } from "@/domain/market/simulated";
import { getPopularInstrument, POPULAR } from "@/domain/market/universe";
import { getCurrentUser } from "@/server/users";

const FEATURES = [
  {
    icon: BarChart3,
    title: "Real stocks",
    text: "Every US-listed stock and ETF, about 12,000 of them, from NVDA to BRK.B, with live quotes when the market's open.",
  },
  {
    icon: Receipt,
    title: "Realistic fees",
    text: "$1 + 0.1% per trade, shown before you confirm. Over-trading has a cost, just like the real thing.",
  },
  {
    icon: Users,
    title: "Private leagues",
    text: "Invite friends with a link. Pick live US hours or a 24/7 simulated market that never sleeps.",
  },
  {
    icon: Trophy,
    title: "Live leaderboards",
    text: "Rankings by return % update in real time, with a feed of every buy, sell and brag.",
  },
  {
    icon: Medal,
    title: "Badges & ranks",
    text: "Climb from Intern to Whale. Unlock Diamond Hands, Diversified and the dreaded Fee Goblin.",
  },
  {
    icon: Smartphone,
    title: "Built for your phone",
    text: "A trading app that fits in your pocket, with press-and-hold to confirm like the big brokers.",
  },
];

const PREVIEW_PLAYERS = [
  { name: "sam", ret: "+18.42%", seed: "sam-preview" },
  { name: "priya", ret: "+11.07%", seed: "priya-preview" },
  { name: "jordan", ret: "+6.93%", seed: "jordan-preview" },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  const now = new Date();
  // The ticker uses the deterministic simulation: no API key or DB round trip needed.
  const quotes = POPULAR.slice(0, 24).map((d) => simulatedQuote(d, "ALWAYS", now));
  // Illustrative hero chart: real simulated wiggles, tilted to match the +18% headline.
  const raw = simulatedHistory(getPopularInstrument("NVDA")!, "ALWAYS", "1M", now).map((p) => p.p);
  const hero = raw.map((p, i) => p * (1 + (0.35 * i) / raw.length));

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[44rem] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-48 left-1/2 h-[30rem] w-[60rem] -translate-x-1/2 rounded-full bg-primary/12 blur-3xl"
      />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          {user ? (
            <Button asChild className="rounded-full">
              <Link href="/dashboard">Open app</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="rounded-full">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild variant="secondary" className="rounded-full">
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main className="relative">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
          <FadeIn className="grid gap-6">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-medium">
              <span className="size-1.5 animate-pulse-dot rounded-full bg-primary" />
              Fantasy stock trading with friends
            </span>
            <h1 className="text-5xl leading-[1.02] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
              Real stocks.
              <br />
              Fake money.
              <br />
              <span className="glow-gain text-primary">Real bragging rights.</span>
            </h1>
            <p className="max-w-lg text-lg text-muted-foreground">
              Start with $10,000, trade real US stocks with realistic fees, and battle your friends up a live
              leaderboard. No risk, all of the adrenaline.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              {user ? (
                <Button asChild size="lg" className="h-12 rounded-xl px-6 text-base font-semibold">
                  <Link href="/dashboard">
                    Go to your dashboard <ArrowRight />
                  </Link>
                </Button>
              ) : (
                <>
                  <DemoButton className="sm:w-56">Try the demo</DemoButton>
                  <Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-6 text-base">
                    <Link href="/signup">Create free account</Link>
                  </Button>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              No card, no email needed for the demo. Not investment advice, obviously.
            </p>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="surface relative mx-auto grid w-full max-w-sm gap-5 p-5 shadow-[0_30px_120px_-30px] shadow-primary/30">
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Portfolio value</span>
                <span className="num text-4xl font-semibold">$11,842.19</span>
                <span className="num text-sm text-gain">▲ $1,842.19 (18.42%) all time</span>
              </div>
              <Sparkline points={hero} positive className="h-28 w-full" />
              <div className="grid gap-2">
                <span className="text-xs font-medium text-muted-foreground">Friday Night Traders</span>
                {PREVIEW_PLAYERS.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3 rounded-xl bg-background/50 px-3 py-2">
                    <span className="w-5 text-center">{["🥇", "🥈", "🥉"][i]}</span>
                    <UserAvatar seed={p.seed} className="size-7" />
                    <span className="flex-1 text-sm font-medium">{p.name}</span>
                    <span className="num text-sm font-semibold text-gain">{p.ret}</span>
                  </div>
                ))}
              </div>
              <div className="absolute -right-3 -bottom-4 rotate-3 rounded-2xl border border-gold/40 bg-popover px-3 py-2 text-sm shadow-xl">
                💎 <span className="font-semibold">Diamond Hands</span> unlocked
              </div>
            </div>
          </FadeIn>
        </section>

        <TickerTape quotes={quotes} />

        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6">
          <FadeIn className="grid max-w-2xl gap-3">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">A trading app that plays like a game</h2>
            <p className="text-muted-foreground">
              Everything a real brokerage does that matters for learning, and nothing that costs you actual money.
            </p>
          </FadeIn>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.05}>
                <div className="surface grid h-full gap-3 p-6 transition-colors hover:border-primary/25">
                  <span className="grid size-10 place-content-center rounded-xl bg-primary/10 text-primary">
                    <f.icon className="size-5" />
                  </span>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.text}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <FadeIn>
            <div className="surface relative grid gap-6 overflow-hidden p-8 text-center sm:p-14">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent"
              />
              <h2 className="relative text-3xl font-semibold tracking-tight sm:text-4xl">
                Think you can beat the market?
              </h2>
              <p className="relative text-muted-foreground">Prove it to your friends. It takes ten seconds.</p>
              <div className="relative mx-auto w-full max-w-xs">
                {user ? (
                  <Button asChild size="lg" className="h-12 w-full rounded-xl text-base font-semibold">
                    <Link href="/dashboard">Open Bullpen</Link>
                  </Button>
                ) : (
                  <DemoButton>Try the demo</DemoButton>
                )}
              </div>
            </div>
          </FadeIn>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <Logo className="text-foreground" />
          <p>Paper trading for fun. Prices may be simulated or delayed. Not financial advice.</p>
        </div>
      </footer>
    </div>
  );
}
