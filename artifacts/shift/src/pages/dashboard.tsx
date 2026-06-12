import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  useGetDashboardStats,
  useGetFunnelBreakdown,
  useGetRecentActivity,
  getGetDashboardStatsQueryKey,
  getGetFunnelBreakdownQueryKey,
  getGetRecentActivityQueryKey,
} from "@workspace/api-client-react";
import {
  ArrowLeft, Users, MousePointerClick, Percent, Clock,
  Activity, User, MapPin, Laptop, Terminal, Briefcase,
  Paintbrush, Radio, TrendingUp,
} from "lucide-react";

const PERSONA = {
  technical: { color: "#22d3ee", bg: "rgba(34,211,238,0.08)", border: "rgba(34,211,238,0.2)", label: "Technical", icon: Terminal },
  business: { color: "#818cf8", bg: "rgba(129,140,248,0.08)", border: "rgba(129,140,248,0.2)", label: "Business", icon: Briefcase },
  creator: { color: "#fb923c", bg: "rgba(251,146,60,0.08)", border: "rgba(251,146,60,0.2)", label: "Creator", icon: Paintbrush },
};

function StatCard({ label, value, sub, accent, icon: Icon }: {
  label: string; value: string | number; sub: string; accent: string; icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 flex flex-col gap-3 hover:border-white/15 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-white/40 uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accent}18`, border: `1px solid ${accent}30` }}>
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </div>
      </div>
      <div className="text-4xl font-black tracking-tight" style={{ color: '#f8fafc' }}>{value}</div>
      <p className="text-xs font-mono text-white/30">{sub}</p>
    </div>
  );
}

function PersonaBar({ persona, count, total, convRate, confidence }: {
  persona: string; count: number; total: number; convRate: number; confidence: number;
}) {
  const cfg = PERSONA[persona as keyof typeof PERSONA] ?? PERSONA.business;
  const Icon = cfg.icon;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="rounded-xl border p-4 space-y-3 transition-colors hover:border-white/15" style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cfg.color}20`, border: `1px solid ${cfg.color}30` }}>
            <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
          </div>
          <span className="font-semibold text-sm text-white/90">{cfg.label}</span>
        </div>
        <span className="text-2xl font-black" style={{ color: cfg.color }}>{count}</span>
      </div>

      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: cfg.color, boxShadow: `0 0 8px ${cfg.color}80` }} />
      </div>

      <div className="flex justify-between text-[11px] font-mono text-white/35">
        <span>{pct}% of traffic</span>
        <span>{(convRate * 100).toFixed(1)}% converted</span>
        <span>{Math.round(confidence * 100)}% conf.</span>
      </div>
    </div>
  );
}

function ActivityRow({ visitor }: { visitor: any }) {
  const cfg = PERSONA[visitor.persona as keyof typeof PERSONA] ?? PERSONA.business;
  const Icon = cfg.icon;

  let hostname = "";
  try { hostname = visitor.referrer ? new URL(visitor.referrer).hostname : ""; } catch {}

  const time = new Date(visitor.createdAt);
  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex items-center gap-4 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all group">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}>
        <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono text-xs text-white/40">{visitor.sessionId.split('-')[0]}···</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
            {cfg.label} · {Math.round((visitor.personaConfidence || 0) * 100)}%
          </span>
          {visitor.converted && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-700/30">✓ Converted</span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-white/25 font-mono">
          {hostname && <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{hostname}</span>}
          {visitor.deviceType && <span className="flex items-center gap-1"><Laptop className="w-2.5 h-2.5" />{visitor.deviceType}</span>}
          {visitor.utmSource && <span className="bg-white/5 px-1.5 py-0.5 rounded">utm={visitor.utmSource}</span>}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="text-xs font-mono text-white/30">{timeStr}</div>
        {visitor.timeOnSite && <div className="text-[10px] font-mono text-white/20">{visitor.timeOnSite}s</div>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: stats } = useGetDashboardStats({ query: { refetchInterval: 10000, queryKey: getGetDashboardStatsQueryKey() } });
  const { data: funnel } = useGetFunnelBreakdown({ query: { refetchInterval: 10000, queryKey: getGetFunnelBreakdownQueryKey() } });
  const { data: recent } = useGetRecentActivity({ query: { refetchInterval: 10000, queryKey: getGetRecentActivityQueryKey() } });

  const convRate = ((stats?.conversionRate || 0) * 100).toFixed(1);

  return (
    <div className="min-h-screen w-full bg-[#030712] text-white font-sans">
      {/* Ambient glow top */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[200px] bg-indigo-600/5 blur-[80px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <header className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-mono text-emerald-400/70 uppercase tracking-widest">Live</span>
              </div>
              <span className="text-[10px] font-mono text-white/20">{now.toLocaleTimeString()}</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-indigo-400" />
              Visitor Intelligence
            </h1>
            <p className="text-sm text-white/30 font-mono mt-1">Real-time personalization telemetry</p>
          </div>
          <Link href="/">
            <button className="flex items-center gap-2 text-xs font-mono text-white/40 hover:text-white/80 transition-colors px-4 py-2.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/[0.02]">
              <ArrowLeft className="w-3.5 h-3.5" />
              Live Site
            </button>
          </Link>
        </header>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Visitors" value={stats?.totalVisitors ?? 0} sub={`${stats?.todayVisitors ?? 0} today`} accent="#818cf8" icon={Users} />
          <StatCard label="Conversions" value={stats?.totalConverted ?? 0} sub={`${stats?.todayConverted ?? 0} today`} accent="#22d3ee" icon={MousePointerClick} />
          <StatCard label="Conv. Rate" value={`${convRate}%`} sub="across all funnels" accent="#fb923c" icon={Percent} />
          <StatCard label="Avg. Session" value={`${Math.round(stats?.avgTimeOnSite ?? 0)}s`} sub="time on site" accent="#34d399" icon={Clock} />
        </div>

        {/* Middle row */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Funnel breakdown */}
          <div className="lg:col-span-2 rounded-2xl border border-white/8 bg-white/[0.02] p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-sm font-semibold text-white/80">Persona Breakdown</h2>
                <p className="text-xs text-white/30 font-mono mt-0.5">Funnel distribution</p>
              </div>
              <TrendingUp className="w-4 h-4 text-white/20" />
            </div>
            <div className="space-y-3">
              {funnel?.map((f) => (
                <PersonaBar
                  key={f.persona}
                  persona={f.persona}
                  count={f.count}
                  total={stats?.totalVisitors ?? 0}
                  convRate={f.conversionRate ?? 0}
                  confidence={f.avgConfidence ?? 0}
                />
              ))}
              {(!funnel || funnel.length === 0) && (
                <div className="text-center py-12 text-xs text-white/25 font-mono">No data yet — visit the live site to generate signals</div>
              )}
            </div>
          </div>

          {/* Activity feed */}
          <div className="lg:col-span-3 rounded-2xl border border-white/8 bg-white/[0.02] p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-sm font-semibold text-white/80">Live Telemetry</h2>
                <p className="text-xs text-white/30 font-mono mt-0.5">Most recent sessions</p>
              </div>
              <Activity className="w-4 h-4 text-white/20 animate-pulse" />
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
              {recent?.map((visitor) => (
                <ActivityRow key={visitor.id} visitor={visitor} />
              ))}
              {(!recent || recent.length === 0) && (
                <div className="text-center py-16 text-xs text-white/25 font-mono flex flex-col items-center gap-3">
                  <Radio className="w-6 h-6 text-white/10 animate-pulse" />
                  Waiting for visitors...
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <footer className="text-center text-[10px] font-mono text-white/15 pb-4">
          SHIFT · Visitor Personalization Engine · Updates every 10s
        </footer>

      </div>
    </div>
  );
}
