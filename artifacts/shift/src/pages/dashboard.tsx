import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  ArrowLeft, Users, MousePointerClick, Percent, Clock,
  Activity, MapPin, Laptop, Terminal, Briefcase,
  Paintbrush, Radio, TrendingUp, Key, ExternalLink, LogOut, Cpu, Save, AlertCircle,
} from "lucide-react";

const PERSONA: Record<string, { color: string; bg: string; border: string; label: string; icon: React.ElementType }> = {
  technical: { color: "#22d3ee", bg: "rgba(34,211,238,0.08)", border: "rgba(34,211,238,0.2)", label: "Technical", icon: Terminal },
  business: { color: "#818cf8", bg: "rgba(129,140,248,0.08)", border: "rgba(129,140,248,0.2)", label: "Business", icon: Briefcase },
  creator: { color: "#fb923c", bg: "rgba(251,146,60,0.08)", border: "rgba(251,146,60,0.2)", label: "Creator", icon: Paintbrush },
};
const DEFAULT_PERSONA = { color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)", label: "Unknown", icon: Activity };
function getPersona(p: string) { return PERSONA[p] ?? DEFAULT_PERSONA; }

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

interface DashboardStats { totalVisitors: number; totalConverted: number; conversionRate: number; avgTimeOnSite: number | null; todayVisitors: number; todayConverted: number; }
interface FunnelStat { persona: string; count: number; conversionRate: number; avgConfidence: number | null; }
interface Visitor { id: number; sessionId: string; persona: string; personaConfidence: number | null; referrer: string | null; deviceType: string | null; utmSource: string | null; converted: boolean; timeOnSite: number | null; createdAt: string; }
interface TimeseriesPoint { date: string; technical: number; business: number; creator: number; total: number; }

function StatCard({ label, value, sub, accent, icon: Icon }: { label: string; value: string | number; sub: string; accent: string; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 flex flex-col gap-3 hover:border-white/15 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-white/40 uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accent}18`, border: `1px solid ${accent}30` }}>
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </div>
      </div>
      <div className="text-4xl font-black tracking-tight text-white">{value}</div>
      <p className="text-xs font-mono text-white/30">{sub}</p>
    </div>
  );
}

function PersonaBar({ persona, count, total, convRate, confidence }: { persona: string; count: number; total: number; convRate: number; confidence: number }) {
  const cfg = getPersona(persona);
  const Icon = cfg.icon;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="rounded-xl border p-4 space-y-3 hover:border-white/15 transition-colors" style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}>
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

function ActivityRow({ visitor }: { visitor: Visitor }) {
  const cfg = getPersona(visitor.persona);
  const Icon = cfg.icon;
  let hostname = "";
  try { hostname = visitor.referrer ? new URL(visitor.referrer).hostname : ""; } catch {}
  const timeStr = new Date(visitor.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="flex items-center gap-4 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}>
        <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="font-mono text-xs text-white/40">{visitor.sessionId.slice(0, 12)}···</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
            {cfg.label} · {Math.round((visitor.personaConfidence || 0) * 100)}%
          </span>
          {visitor.converted && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-700/30">✓ Converted</span>}
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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a14]/95 backdrop-blur p-3 shadow-xl">
      <p className="text-xs font-mono text-white/50 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-xs font-mono">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-white/60 capitalize">{p.dataKey}:</span>
          <span className="text-white font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [now, setNow] = useState(new Date());
  const [account, setAccount] = useState<{ name: string; website: string | null } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [provider, setProvider] = useState("rules");
  const [providerModel, setProviderModel] = useState("");
  const [providerKey, setProviderKey] = useState("");
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    apiFetch<{ name: string; website: string | null }>("/api/auth/session")
      .then((data) => { setAccount(data); setAuthReady(true); })
      .catch(() => navigate("/login"));
    apiFetch<{ provider: string; model: string | null; configured: boolean }>("/api/settings/ai")
      .then((data) => { setProvider(data.provider); setProviderModel(data.model ?? ""); setProviderConfigured(data.configured); })
      .catch(() => {});
  }, [navigate]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    navigate("/");
  };

  const saveProvider = async () => {
    setSettingsMessage(null);
    const res = await fetch("/api/settings/ai", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, model: providerModel || null, apiKey: providerKey || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setSettingsMessage(data.error ?? "Could not save provider settings"); return; }
    setProviderConfigured(data.configured);
    setProviderKey("");
    setSettingsMessage("Provider settings saved");
  };

  const { data: stats, error: statsError } = useQuery<DashboardStats>({ queryKey: ["stats"], queryFn: () => apiFetch("/api/dashboard/stats"), enabled: authReady, refetchInterval: 10000 });
  const { data: funnel } = useQuery<FunnelStat[]>({ queryKey: ["funnel"], queryFn: () => apiFetch("/api/dashboard/funnel-breakdown"), enabled: authReady, refetchInterval: 10000 });
  const { data: recent } = useQuery<Visitor[]>({ queryKey: ["recent"], queryFn: () => apiFetch("/api/dashboard/recent-activity"), enabled: authReady, refetchInterval: 10000 });
  const { data: timeseries } = useQuery<TimeseriesPoint[]>({ queryKey: ["timeseries"], queryFn: () => apiFetch("/api/dashboard/timeseries?days=7"), enabled: authReady, refetchInterval: 30000 });

  const convRate = ((stats?.conversionRate || 0) * 100).toFixed(1);
  const hasChartData = timeseries?.some(d => d.total > 0);

  return (
    <div className="min-h-screen w-full bg-[#030712] text-white font-sans">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[200px] bg-indigo-600/5 blur-[80px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono text-emerald-400/70 uppercase tracking-widest">Live</span>
              <span className="text-[10px] font-mono text-white/20">{now.toLocaleTimeString()}</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-indigo-400" />
              Visitor Intelligence
            </h1>
            <p className="text-sm text-white/30 font-mono mt-1">Real-time personalization telemetry</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/"><button className="flex items-center gap-2 text-xs font-mono text-white/40 hover:text-white/80 transition-colors px-4 py-2.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/[0.02]"><ArrowLeft className="w-3.5 h-3.5" />Live Site</button></Link>
            {account && (
              <button onClick={handleLogout} className="flex items-center gap-2 text-xs font-mono text-white/30 hover:text-red-400 transition-colors px-3 py-2.5 rounded-xl border border-white/8 hover:border-red-800/30 bg-white/[0.02]">
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            )}
          </div>
        </header>

        <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-indigo-700/20 bg-indigo-950/10">
          <div className="flex items-center gap-3 min-w-0">
            <Key className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span className="text-xs font-mono text-white/50">Secure site workspace</span>
            <span className="text-xs font-semibold text-white/80">{account?.name ?? "Loading…"}</span>
            {account?.website && <span className="text-xs font-mono text-white/20 hidden sm:inline">{account.website}</span>}
          </div>
          <Link href="/start"><button className="flex items-center gap-1.5 text-[11px] font-mono text-indigo-400 hover:text-indigo-300 transition-colors flex-shrink-0">Install guide <ExternalLink className="w-3 h-3" /></button></Link>
        </div>

        {statsError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-800/30 bg-red-950/20 px-4 py-3 text-xs text-red-300" role="alert">
            <AlertCircle className="w-4 h-4" /> Analytics could not be loaded. Try signing in again or refresh the page.
          </div>
        )}

        <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-6" aria-labelledby="ai-provider-heading">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 id="ai-provider-heading" className="text-sm font-semibold text-white/80 flex items-center gap-2"><Cpu className="w-4 h-4 text-cyan-400" />AI provider</h2>
              <p className="text-xs text-white/30 font-mono mt-1">Bring your own provider, or use the private rules engine with no external AI.</p>
            </div>
            <span className="text-[10px] font-mono text-white/30 border border-white/8 rounded px-2 py-1">{providerConfigured ? "Credential encrypted" : "No external credential"}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-xs font-mono text-white/40">Provider
              <select value={provider} onChange={(e) => setProvider(e.target.value)} className="mt-1.5 w-full bg-[#090914] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50">
                <option value="rules">Built-in rules</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="google">Google Gemini</option><option value="groq">Groq</option>
              </select>
            </label>
            <label className="text-xs font-mono text-white/40">Model override
              <input value={providerModel} onChange={(e) => setProviderModel(e.target.value)} placeholder="Use provider default" className="mt-1.5 w-full bg-[#090914] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-cyan-500/50" />
            </label>
            <label className="text-xs font-mono text-white/40">Provider API key
              <input type="password" autoComplete="off" value={providerKey} onChange={(e) => setProviderKey(e.target.value)} disabled={provider === "rules"} placeholder={providerConfigured ? "Leave blank to keep current" : "Required for external AI"} className="mt-1.5 w-full bg-[#090914] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-cyan-500/50 disabled:opacity-40" />
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className={`text-xs font-mono ${settingsMessage?.includes("saved") ? "text-emerald-400" : "text-red-400"}`} role="status">{settingsMessage}</p>
            <button onClick={saveProvider} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-semibold"><Save className="w-4 h-4" />Save provider</button>
          </div>
        </section>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Visitors" value={stats?.totalVisitors ?? 0} sub={`${stats?.todayVisitors ?? 0} today`} accent="#818cf8" icon={Users} />
          <StatCard label="Conversions" value={stats?.totalConverted ?? 0} sub={`${stats?.todayConverted ?? 0} today`} accent="#22d3ee" icon={MousePointerClick} />
          <StatCard label="Conv. Rate" value={`${convRate}%`} sub="across all funnels" accent="#fb923c" icon={Percent} />
          <StatCard label="Avg. Session" value={`${Math.round(stats?.avgTimeOnSite ?? 0)}s`} sub="time on site" accent="#34d399" icon={Clock} />
        </div>

        {/* Time-series chart */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold text-white/80">Visitor Trends</h2>
              <p className="text-xs text-white/30 font-mono mt-0.5">Last 7 days by persona</p>
            </div>
            <TrendingUp className="w-4 h-4 text-white/20" />
          </div>
          {hasChartData ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={timeseries} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradTech" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradBiz" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradCreator" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fb923c" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)' }} />
                <Area type="monotone" dataKey="technical" stroke="#22d3ee" strokeWidth={2} fill="url(#gradTech)" name="Technical" dot={false} />
                <Area type="monotone" dataKey="business" stroke="#818cf8" strokeWidth={2} fill="url(#gradBiz)" name="Business" dot={false} />
                <Area type="monotone" dataKey="creator" stroke="#fb923c" strokeWidth={2} fill="url(#gradCreator)" name="Creator" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center">
              <div className="text-center">
                <TrendingUp className="w-8 h-8 text-white/8 mx-auto mb-2" />
                <p className="text-xs text-white/25 font-mono">Chart populates once visitors arrive</p>
              </div>
            </div>
          )}
        </div>

        {/* Middle row — persona breakdown + live feed */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
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
                <PersonaBar key={f.persona} persona={f.persona} count={f.count} total={stats?.totalVisitors ?? 0} convRate={f.conversionRate ?? 0} confidence={f.avgConfidence ?? 0} />
              ))}
              {(!funnel || funnel.length === 0) && (
                <div className="text-center py-12 text-xs text-white/25 font-mono">No data yet</div>
              )}
            </div>
          </div>

          <div className="lg:col-span-3 rounded-2xl border border-white/8 bg-white/[0.02] p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-sm font-semibold text-white/80">Live Telemetry</h2>
                <p className="text-xs text-white/30 font-mono mt-0.5">Most recent sessions</p>
              </div>
              <Activity className="w-4 h-4 text-white/20 animate-pulse" />
            </div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
              {recent?.map((v) => <ActivityRow key={v.id} visitor={v} />)}
              {(!recent || recent.length === 0) && (
                <div className="text-center py-16 text-xs text-white/25 font-mono flex flex-col items-center gap-3">
                  <Radio className="w-6 h-6 text-white/10 animate-pulse" />
                  Waiting for visitors...
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="text-center text-[10px] font-mono text-white/15 pb-4">
          SHIFT · Visitor Personalization Engine · Updates every 10s
        </footer>
      </div>
    </div>
  );
}
