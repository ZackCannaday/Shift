import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useSession } from "@/hooks/use-session";
import { useDetectIntent, useUpdateVisitor } from "@workspace/api-client-react";
import { Activity, ArrowRight, LayoutDashboard, Terminal, Briefcase, Paintbrush, Zap, Shield, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IntentResult } from "@workspace/api-client-react";

const PERSONA_CONFIG = {
  technical: {
    icon: Terminal,
    accent: "#22d3ee",
    glow: "rgba(34,211,238,0.15)",
    ring: "rgba(34,211,238,0.4)",
    bg: "#030712",
    label: "Engineer Mode",
    badge: "bg-cyan-950/60 text-cyan-300 border-cyan-700/40",
    btnClass: "bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_40px_rgba(34,211,238,0.4)]",
    orbColor: "#0e7490",
  },
  business: {
    icon: Briefcase,
    accent: "#818cf8",
    glow: "rgba(129,140,248,0.15)",
    ring: "rgba(129,140,248,0.4)",
    bg: "#05050f",
    label: "Executive View",
    badge: "bg-indigo-950/60 text-indigo-300 border-indigo-700/40",
    btnClass: "bg-indigo-500 hover:bg-indigo-400 text-white shadow-[0_0_40px_rgba(129,140,248,0.4)]",
    orbColor: "#312e81",
  },
  creator: {
    icon: Paintbrush,
    accent: "#fb923c",
    glow: "rgba(251,146,60,0.15)",
    ring: "rgba(251,146,60,0.4)",
    bg: "#0c0804",
    label: "Creator Studio",
    badge: "bg-orange-950/60 text-orange-300 border-orange-700/40",
    btnClass: "bg-orange-500 hover:bg-orange-400 text-white shadow-[0_0_40px_rgba(251,146,60,0.4)]",
    orbColor: "#7c2d12",
  },
};

const DEFAULT_CONFIG = PERSONA_CONFIG.business;

function LoadingState() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#030712] overflow-hidden relative">
      <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl opacity-10 bg-cyan-500 animate-pulse" />
      <div className="flex flex-col items-center gap-5 z-10">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border border-cyan-500/30 animate-spin" style={{ borderTopColor: '#22d3ee' }} />
          <Activity className="absolute inset-0 m-auto w-5 h-5 text-cyan-400" />
        </div>
        <div className="text-center">
          <p className="text-xs text-cyan-400/70 tracking-[0.3em] uppercase font-mono mb-1">Shift Engine</p>
          <p className="text-sm text-white/30 font-mono">reading your signals...</p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const sessionId = useSession();
  const [intentData, setIntentData] = useState<IntentResult | null>(null);
  const [revealed, setRevealed] = useState(false);

  const detectIntent = useDetectIntent();
  const updateVisitor = useUpdateVisitor();

  useEffect(() => {
    if (!sessionId) return;
    const stored = sessionStorage.getItem('shift_intent_result');
    if (stored) {
      setIntentData(JSON.parse(stored));
      setTimeout(() => setRevealed(true), 100);
      return;
    }
    if (detectIntent.isPending || detectIntent.isSuccess) return;
    detectIntent.mutate({
      data: {
        sessionId,
        referrer: document.referrer,
        utmSource: new URLSearchParams(window.location.search).get('utm_source') || undefined,
        utmMedium: new URLSearchParams(window.location.search).get('utm_medium') || undefined,
        utmCampaign: new URLSearchParams(window.location.search).get('utm_campaign') || undefined,
        userAgent: navigator.userAgent,
        deviceType: window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop',
        pageTitle: document.title,
      }
    }, {
      onSuccess: (data) => {
        setIntentData(data);
        sessionStorage.setItem('shift_intent_result', JSON.stringify(data));
        setTimeout(() => setRevealed(true), 100);
      }
    });
  }, [sessionId]);

  const handleConvert = () => {
    if (intentData?.visitorId) {
      updateVisitor.mutate({ id: intentData.visitorId, data: { converted: true, conversionEvent: 'cta_click' } });
    }
  };

  if (!intentData) return <LoadingState />;

  const persona = (intentData.persona as keyof typeof PERSONA_CONFIG) || 'business';
  const cfg = PERSONA_CONFIG[persona] ?? DEFAULT_CONFIG;
  const Icon = cfg.icon;

  return (
    <div
      className="min-h-screen w-full flex flex-col relative overflow-hidden transition-colors duration-1000"
      style={{ backgroundColor: cfg.bg, color: '#f8fafc' }}
    >
      {/* Dot grid */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

      {/* Ambient orbs */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-[120px] opacity-20 pointer-events-none transition-colors duration-1000" style={{ backgroundColor: cfg.orbColor }} />
      <div className="absolute -bottom-40 -right-20 w-[500px] h-[500px] rounded-full blur-[100px] opacity-10 pointer-events-none transition-colors duration-1000" style={{ backgroundColor: cfg.accent }} />

      {/* Header */}
      <header className="w-full px-6 py-5 flex justify-between items-center z-10 border-b border-white/5">
        <div className="flex items-center gap-2 font-mono font-bold tracking-widest text-sm" style={{ color: cfg.accent }}>
          <div className="w-7 h-7 rounded flex items-center justify-center text-xs font-black" style={{ backgroundColor: cfg.accent, color: cfg.bg }}>S</div>
          SHIFT
        </div>
        <Link href="/dashboard">
          <button className="flex items-center gap-2 text-xs font-mono text-white/40 hover:text-white/80 transition-colors px-3 py-1.5 rounded border border-white/10 hover:border-white/20">
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard
          </button>
        </Link>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 z-10 max-w-5xl mx-auto w-full text-center">

        {/* Persona badge */}
        <div className={`animate-in fade-in slide-in-from-bottom-3 duration-700 fill-mode-both delay-100 inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-mono mb-10 ${cfg.badge}`}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: cfg.accent }} />
          <Icon className="w-3.5 h-3.5" />
          {cfg.label}
          <span className="opacity-40">·</span>
          <span style={{ color: cfg.accent }}>{Math.round(intentData.confidence * 100)}% confidence</span>
        </div>

        {/* Headline */}
        <h1
          className={`text-5xl md:text-7xl font-black tracking-tight mb-6 leading-[1.05] animate-in fade-in slide-in-from-bottom-6 duration-700 fill-mode-both delay-200 ${revealed ? '' : 'opacity-0'}`}
          style={{ textShadow: `0 0 80px ${cfg.glow}` }}
        >
          {intentData.headline}
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-white/50 max-w-2xl mb-12 animate-in fade-in slide-in-from-bottom-6 duration-700 fill-mode-both delay-300 leading-relaxed font-light">
          {intentData.subheadline}
        </p>

        {/* CTA */}
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 fill-mode-both delay-500 flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={handleConvert}
            className={`flex items-center gap-2 px-8 py-4 rounded-full text-base font-semibold transition-all hover:scale-105 active:scale-95 ${cfg.btnClass}`}
          >
            {intentData.ctaText}
            <ArrowRight className="w-4 h-4" />
          </button>
          <span className="text-xs text-white/25 font-mono">No signup required</span>
        </div>

        {/* Feature strip */}
        <div className="animate-in fade-in duration-700 fill-mode-both delay-700 mt-20 grid grid-cols-3 gap-6 max-w-xl w-full">
          {[
            { icon: Zap, label: "Instant detection", sub: "< 200ms per visit" },
            { icon: Shield, label: "Privacy first", sub: "No cookies needed" },
            { icon: Globe, label: "Any traffic source", sub: "UTM · Referrer · UA" },
          ].map(({ icon: I, label, sub }) => (
            <div key={label} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-white/5 bg-white/[0.02]">
              <I className="w-4 h-4" style={{ color: cfg.accent }} />
              <span className="text-xs font-medium text-white/70">{label}</span>
              <span className="text-[10px] text-white/30 font-mono">{sub}</span>
            </div>
          ))}
        </div>

        {/* Intelligence log */}
        {intentData.reasoning && (
          <div className="mt-16 animate-in fade-in duration-700 fill-mode-both delay-1000 max-w-lg w-full p-4 rounded-xl border border-white/5 bg-white/[0.02] text-left">
            <p className="text-[10px] font-mono mb-2 flex items-center gap-1.5" style={{ color: cfg.accent }}>
              <Activity className="w-3 h-3" />
              SHIFT ENGINE · DETECTION LOG
            </p>
            <p className="text-xs text-white/35 font-mono leading-relaxed">{intentData.reasoning}</p>
          </div>
        )}
      </main>
    </div>
  );
}
