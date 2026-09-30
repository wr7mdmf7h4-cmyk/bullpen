import Link from "next/link";
import { ArrowRight, BarChart3, Medal, Receipt, Smartphone, Trophy, Users } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { FadeIn } from "@/components/landing/fade-in";
import { TickerTape } from "@/components/landing/ticker-tape";
import { Delta } from "@/components/market/delta";
import { MarketStatusPill } from "@/components/market/market-status-pill";
import { TickerBadge } from "@/components/market/ticker-badge";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/domain/money";
import { changeBps, changeCents } from "@/domain/market/types";
import { marketStatus } from "@/domain/market/status";
import { POPULAR } from "@/domain/market/universe";
import { serializeStatus } from "@/lib/market-status";
import { getQuotes } from "@/server/market";
import { getCurrentUser } from "@/server/users";

const FEATURES = [
  {
    icon: BarChart3,
    title: "Real stocks, real prices",
    text: "Every US-listed stock and ETF, about 12,000 of them, from NVDA to BRK.B, at live market prices.",
  },
  {
    icon: Receipt,
    title: "Realistic fees",
    text: "$1 + 0.1% per trade, shown before you confirm. Over-trading has a cost, just like the real thing.",
  },
  {
    icon: Users,
    title: "Private leagues",
    text: "Invite friends with a link, set the dates, starting cash and fees, and see who really can pick stocks.",
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

const HERO_SYMBOLS = ["SPY", "QQQ", "NVDA", "AAPL", "TSLA"];

export default async function LandingPage() {
  const user = await getCurrentUser();
  const now = new Date();
  // Last real prices from the shared cache. maxFetch 0: anonymous visitors
  // never spend data-provider calls.
  const quotes = await getQuotes([...new Set([...HERO_SYMBOLS, ...POPULAR.slice(0, 24).map((d) => d.symbol)])], {
    now,
    maxFetch: 0,
  });
  const hero = HERO_SYMBOLS.flatMap((s) => {
    const q = quotes.get(s);
    return q ? [q] : [];
  });
  const tape = POPULAR.slice(0, 24).flatMap((d) => {
    const q = quotes.get(d.symbol);
    return q ? [q] : [];
  });

  const primaryCta = user ? (
    <Button asChild size="lg" className="h-12 rounded-xl px-6 text-base font-semibold">
      <Link href="/dashboard">
        Go to your dashboard <ArrowRight />
      </Link>
    </Button>
  ) : (
    <Button
      asChild
      size="lg"
      className="h-12 rounded-xl px-6 text-base font-semibold shadow-[0_0_40px_-8px] shadow-primary/60"
    >
      <Link href="/signup">
        Start with $10,000 <ArrowRight />
      </Link>
    </Button>
  );

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
              Start with $10,000, trade real US stocks at live prices with realistic fees, and battle your friends up a
              live leaderboard. No risk, all of the adrenaline.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              {primaryCta}
              {!user && (
                <Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-6 text-base">
                  <Link href="/login">I have an account</Link>
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Free. No card. Not investment advice, obviously.</p>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="surface relative mx-auto grid w-full max-w-sm gap-4 p-5 shadow-[0_30px_120px_-30px] shadow-primary/30">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">Live market</span>
                <MarketStatusPill status={serializeStatus(marketStatus(now))} />
              </div>
              {hero.length ? (
                <ul className="grid gap-2">
                  {hero.map((q) => (
                    <li key={q.symbol} className="flex items-center gap-3 rounded-xl bg-background/50 px-3 py-2">
                      <TickerBadge symbol={q.symbol} className="size-8 text-[10px]" />
                      <span className="flex-1 font-mono text-sm font-semibold">{q.symbol}</span>
                      <span className="grid justify-items-end">
                        <span className="num text-sm font-semibold">{formatCents(q.priceCents)}</span>
                        <Delta bps={changeBps(q)} cents={changeCents(q)} showCents={false} size="xs" />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl bg-background/50 p-4 text-sm text-muted-foreground">
                  Live prices appear here once the market data warms up.
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Real US market prices. Trade them with $10,000 of fake money.
              </p>
            </div>
          </FadeIn>
        </section>

        {tape.length >= 6 && <TickerTape quotes={tape} />}

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
              <div className="relative mx-auto">{primaryCta}</div>
            </div>
          </FadeIn>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <Logo className="text-foreground" />
          <p>Paper trading for fun with real market prices. Not financial advice.</p>
        </div>
      </footer>
    </div>
  );
}
