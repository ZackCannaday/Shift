import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useSession } from "@/hooks/use-session";
import { useDetectIntent, useUpdateVisitor } from "@workspace/api-client-react";
import { Activity, ShieldCheck, ArrowRight, LayoutDashboard, Terminal, Briefcase, Paintbrush } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IntentResult } from "@workspace/api-client-react";

export default function Home() {
  const sessionId = useSession();
  const [intentData, setIntentData] = useState<IntentResult | null>(null);
  
  const detectIntent = useDetectIntent();
  const updateVisitor = useUpdateVisitor();

  useEffect(() => {
    if (!sessionId) return;
    const stored = sessionStorage.getItem('shift_intent_result');
    if (stored) {
      setIntentData(JSON.parse(stored));
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
        pageTitle: document.title
      }
    }, {
      onSuccess: (data) => {
        setIntentData(data);
        sessionStorage.setItem('shift_intent_result', JSON.stringify(data));
      }
    });
  }, [sessionId]);

  const handleConvert = () => {
    if (intentData?.visitorId) {
      updateVisitor.mutate({
        id: intentData.visitorId,
        data: {
          converted: true,
          conversionEvent: 'cta_click'
        }
      });
    }
  };

  if (!intentData) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground overflow-hidden relative">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="flex flex-col items-center gap-6 animate-pulse z-10">
          <Activity className="w-8 h-8 text-primary opacity-80" />
          <p className="text-sm text-muted-foreground tracking-[0.2em] uppercase font-mono">reading your context...</p>
        </div>
      </div>
    );
  }

  const theme = intentData.funnelTheme || 'default';
  
  // Theme logic
  let themeStyles = "bg-background text-foreground";
  let Icon = Activity;
  let ThemeIcon = ShieldCheck;
  
  if (theme === 'technical') {
    themeStyles = "bg-[#050505] text-[#E0E0E0] border-[#1A1A1A]";
    ThemeIcon = Terminal;
  } else if (theme === 'business') {
    themeStyles = "bg-[#0A0D14] text-[#F8FAFC] border-[#1E293B]";
    ThemeIcon = Briefcase;
  } else if (theme === 'creator') {
    themeStyles = "bg-[#1C1917] text-[#FDF8F6] border-[#292524]";
    ThemeIcon = Paintbrush;
  }

  return (
    <div className={`min-h-screen w-full flex flex-col relative transition-colors duration-1000 ${themeStyles}`}>
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      
      {/* Header */}
      <header className="w-full p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2 font-mono font-bold tracking-tight">
          <div className="w-6 h-6 bg-primary rounded-sm flex items-center justify-center text-primary-foreground">
            S
          </div>
          SHIFT
        </div>
        <Link href="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-mono">
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 z-10 max-w-5xl mx-auto w-full text-center">
        
        {/* Confidence Badge */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 fill-mode-both delay-100">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-background/50 backdrop-blur-sm text-xs font-mono text-muted-foreground mb-8">
            <ThemeIcon className="w-3.5 h-3.5" />
            Detected Profile: <span className="text-foreground font-semibold">{intentData.persona}</span>
            <span className="opacity-50">|</span>
            <span className="text-primary">{Math.round(intentData.confidence * 100)}% Match</span>
          </div>
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both delay-300 leading-tight">
          {intentData.headline}
        </h1>
        
        <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both delay-500 leading-relaxed">
          {intentData.subheadline}
        </p>

        <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both delay-700">
          <Button 
            size="lg" 
            className="h-14 px-8 text-lg rounded-full gap-2 shadow-2xl hover:scale-105 transition-transform"
            onClick={handleConvert}
          >
            {intentData.ctaText}
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>

        {intentData.reasoning && (
          <div className="mt-24 pt-8 border-t border-border/50 max-w-xl text-left animate-in fade-in duration-1000 fill-mode-both delay-1000">
            <p className="text-xs font-mono text-muted-foreground mb-2 flex items-center gap-2">
              <Activity className="w-3 h-3" />
              Intelligence Engine Log
            </p>
            <p className="text-sm text-muted-foreground/80 font-mono leading-relaxed">
              {intentData.reasoning}
            </p>
          </div>
        )}

      </main>
    </div>
  );
}
