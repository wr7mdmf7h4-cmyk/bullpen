import Link from "next/link";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { TrafficChart } from "@/components/admin/traffic-chart";
import { ADMIN_TIME_ZONE, dayKey } from "@/domain/admin";
import { timeAgo } from "@/lib/time";
import type { TrafficStats } from "@/server/analytics";

const number = new Intl.NumberFormat("en-US");
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: ADMIN_TIME_ZONE });
const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: ADMIN_TIME_ZONE });

function flag(code: string) {
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function countryName(code: string | null) {
  if (!code) return "Unknown";
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

const DEVICE_ICON = { mobile: Smartphone, tablet: Tablet, desktop: Monitor } as const;
function DeviceIcon({ device }: { device: string }) {
  const Icon = DEVICE_ICON[device as keyof typeof DEVICE_ICON] ?? Monitor;
  return <Icon className="size-3.5" aria-label={device} />;
}

function Tile({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="surface grid gap-1 p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="num text-2xl font-semibold">{number.format(value)}</span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </div>
  );
}

function CountList({
  title,
  rows,
  render,
  empty,
}: {
  title: string;
  rows: { label: string | null; views: number; visitors: number }[];
  render: (label: string | null) => React.ReactNode;
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.visitors));
  return (
    <div className="surface grid content-start gap-1 p-4">
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>{title}</span>
        <span>Visitors</span>
      </div>
      {rows.length ? (
        rows.map((r) => (
          <div key={r.label ?? "none"} className="relative flex items-center justify-between gap-3 py-1 text-sm">
            <span
              aria-hidden
              className="absolute inset-y-0.5 left-0 rounded bg-primary/10"
              style={{ width: `${(r.visitors / max) * 100}%` }}
            />
            <span className="relative truncate pl-1.5">{render(r.label)}</span>
            <span className="num relative pr-1">{number.format(r.visitors)}</span>
          </div>
        ))
      ) : (
        <p className="py-1 text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

export function TrafficSection({ traffic, now }: { traffic: TrafficStats; now: Date }) {
  const { totals } = traffic;
  const nowMs = now.getTime();
  const when = (at: Date) => {
    const day = dayKey(at, ADMIN_TIME_ZONE);
    const yesterday = dayKey(new Date(nowMs - 86_400_000), ADMIN_TIME_ZONE);
    const prefix = day === traffic.today ? "" : day === yesterday ? "Yesterday " : `${shortDate.format(at)} `;
    return `${prefix}${clock.format(at)}`;
  };

  return (
    <section className="grid content-start gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">Site traffic</h2>
        <span className="text-xs text-muted-foreground">No cookies · bots ignored · kept 90 days</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Visitors, last 24h"
          value={totals.visitors24h}
          detail={`${number.format(totals.views24h)} page views`}
        />
        <Tile
          label="Visitors, last 7 days"
          value={totals.visitors7d}
          detail={`${number.format(totals.views7d)} page views`}
        />
        <Tile label="Page views, 30 days" value={totals.views30d} detail="every page anyone opened" />
        <Tile
          label="Pages per visitor"
          value={Number(totals.visitors7d ? (totals.views7d / totals.visitors7d).toFixed(1) : 0)}
          detail="average, last 7 days"
        />
      </div>

      <div className="surface p-4">
        <TrafficChart hourly={traffic.hourly} daily={traffic.daily} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <CountList
          title="Top pages (7 days)"
          rows={traffic.pages}
          empty="No views yet."
          render={(path) => <span className="font-mono text-xs">{path}</span>}
        />
        <CountList
          title="Came from (30 days)"
          rows={traffic.referrers}
          empty="Everyone typed the address or used a bookmark."
          render={(host) => host}
        />
        <CountList
          title="Countries (30 days)"
          rows={traffic.countries}
          empty="No views yet."
          render={(code) => (
            <>
              {code && <span className="mr-1.5">{flag(code)}</span>}
              {countryName(code)}
            </>
          )}
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold">Recent visits</h3>
          <span className="text-xs text-muted-foreground">
            Latest 50 · UK time ·{" "}
            {traffic.devices.map((d) => `${number.format(d.visitors)} ${d.label ?? "other"}`).join(" · ") ||
              "no devices yet"}
          </span>
        </div>
        {traffic.recent.length ? (
          <div className="surface max-h-[28rem] overflow-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-normal">When</th>
                  <th className="px-4 py-2.5 font-normal">Page</th>
                  <th className="px-4 py-2.5 font-normal">Who</th>
                  <th className="px-4 py-2.5 font-normal">Where</th>
                  <th className="px-4 py-2.5 font-normal">From</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {traffic.recent.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="num">{when(v.at)}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{timeAgo(v.at.getTime(), nowMs)}</span>
                    </td>
                    <td className="max-w-[14rem] truncate px-4 py-2 font-mono text-xs">{v.path}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {v.visitor.kind === "user" ? (
                        <Link href={`/u/${v.visitor.username}`} className="font-medium hover:text-primary">
                          @{v.visitor.username}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          Guest <span className="font-mono text-xs">#{v.visitor.tag}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <DeviceIcon device={v.device} />
                        {v.country ? `${flag(v.country)} ${countryName(v.country)}` : "Unknown"}
                      </span>
                    </td>
                    <td className="max-w-[10rem] truncate px-4 py-2 text-muted-foreground">{v.referrer ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="surface p-4 text-sm text-muted-foreground">
            No visits recorded yet. They appear here as soon as someone opens the site.
          </p>
        )}
      </div>
    </section>
  );
}
