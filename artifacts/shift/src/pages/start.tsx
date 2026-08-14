import { useState } from "react";
import { Link } from "wouter";
import { CheckCircle, Copy, ArrowRight, Code2, Globe, BarChart3, Zap, ChevronRight, Terminal } from "lucide-react";

const API_BASE = "/api";

interface ApiKeyResult {
  id: number;
  key: string;
  name: string;
  email: string;
  website?: string | null;
  createdAt: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 transition-all"
    >
      {copied ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden">
      {label && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/8 bg-white/[0.02]">
          <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">{label}</span>
          <CopyButton text={code} />
        </div>
      )}
      <pre className="p-4 text-sm font-mono text-cyan-300/90 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">{code}</pre>
    </div>
  );
}

const STEPS = [
  { n: "1", label: "Generate your key", done: (k: boolean) => k },
  { n: "2", label: "Add the script tag", done: () => false },
  { n: "3", label: "Go live", done: () => false },
];

export default function Start() {
  const [form, setForm] = useState({ name: "", email: "", website: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiKeyResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/keys`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          website: form.website.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      const data: ApiKeyResult = await res.json();
      setResult(data);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const scriptTag = result
    ? `<script src="${window.location.origin}/api/shift.js"\n  data-shift-key="${result.key}"\n  data-shift-auto="true">\n</script>`
    : "";

  const htmlExample = result
    ? `<!DOCTYPE html>\n<html>\n<head>\n  <!-- Add Shift before </head> -->\n  <script src="${window.location.origin}/api/shift.js"\n    data-shift-key="${result.key}"\n    data-shift-auto="true">\n  </script>\n</head>\n<body>\n  <h1 data-shift-headline>Your default headline</h1>\n  <p data-shift-subheadline>Your default subheadline</p>\n  <button data-shift-cta data-shift-conversion="primary_cta">Get Started</button>\n</body>\n</html>`
    : "";

  const jsExample = result
    ? `window.addEventListener('shift:ready', function(e) {\n  var persona = e.detail.persona;    // "technical" | "business" | "creator"\n  var headline = e.detail.headline;  // personalized headline\n  var ctaText  = e.detail.ctaText;   // personalized CTA\n  // Update your UI here\n  console.log('[Shift] Detected:', persona);\n});`
    : "";

  return (
    <div className="min-h-screen bg-[#030712] text-white font-sans">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[300px] bg-indigo-600/6 blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-cyan-600/4 blur-[120px]" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      </div>

      <div className="relative max-w-3xl mx-auto px-6 py-16">

        {/* Nav */}
        <div className="flex items-center justify-between mb-16">
          <Link href="/">
            <span className="flex items-center gap-2 font-mono font-black tracking-widest text-sm text-cyan-400">
              <span className="w-7 h-7 rounded bg-cyan-400 text-black text-xs font-black flex items-center justify-center">S</span>
              SHIFT
            </span>
          </Link>
          <Link href="/dashboard">
            <span className="text-xs font-mono text-white/30 hover:text-white/60 transition-colors flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              Dashboard
            </span>
          </Link>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-12">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold border transition-all ${
                (i === 0 && result) ? "bg-emerald-500 border-emerald-500 text-black" :
                (i === 0 && !result) ? "border-cyan-500 text-cyan-400" :
                "border-white/10 text-white/20"
              }`}>
                {(i === 0 && result) ? <CheckCircle className="w-3.5 h-3.5" /> : s.n}
              </div>
              <span className={`text-xs font-mono transition-colors ${
                (i === 0) ? (result ? "text-emerald-400" : "text-white/70") : "text-white/20"
              }`}>{s.label}</span>
              {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-white/15 mx-1" />}
            </div>
          ))}
        </div>

        {!result ? (
          /* ── Step 1: Form ── */
          <div>
            <div className="mb-10">
              <h1 className="text-4xl font-black tracking-tight mb-3">
                Add AI personalization<br />
                <span className="text-cyan-400">to any website</span> in 60 seconds
              </h1>
              <p className="text-white/40 text-base leading-relaxed">
                One script tag. Every visitor gets a headline, subheadline, and CTA tailored to their intent — no code changes required.
              </p>
            </div>

            {/* Value props */}
            <div className="grid grid-cols-3 gap-3 mb-10">
              {[
                { icon: Zap, label: "Instant", sub: "< 200ms detection" },
                { icon: Code2, label: "One line", sub: "Drop in a script tag" },
                { icon: Globe, label: "Any site", sub: "Works everywhere" },
              ].map(({ icon: I, label, sub }) => (
                <div key={label} className="p-4 rounded-xl border border-white/6 bg-white/[0.02] text-center">
                  <I className="w-4 h-4 text-cyan-400 mx-auto mb-2" />
                  <div className="text-xs font-semibold text-white/80">{label}</div>
                  <div className="text-[10px] font-mono text-white/30 mt-0.5">{sub}</div>
                </div>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-white/40 mb-1.5 uppercase tracking-wider">Your name or company</label>
                <input
                  type="text"
                  required
                  placeholder="Acme Inc."
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-white/40 mb-1.5 uppercase tracking-wider">Email address</label>
                <input
                  type="email"
                  required
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-white/40 mb-1.5 uppercase tracking-wider">Your website <span className="text-white/20 normal-case">(optional)</span></label>
                <input
                  type="url"
                  placeholder="https://yoursite.com"
                  value={form.website}
                  onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                />
              </div>
              {error && (
                <div className="text-xs text-red-400 font-mono bg-red-950/30 border border-red-800/30 rounded-xl px-4 py-3">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm transition-all shadow-[0_0_40px_rgba(34,211,238,0.25)] hover:shadow-[0_0_50px_rgba(34,211,238,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                    Generating your key...
                  </>
                ) : (
                  <>
                    Generate My API Key
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              <p className="text-center text-[10px] text-white/20 font-mono">Free to use · No credit card required</p>
            </form>
          </div>
        ) : (
          /* ── Steps 2 & 3: Key generated ── */
          <div className="space-y-8">
            {/* Success banner */}
            <div className="rounded-2xl border border-emerald-700/30 bg-emerald-950/20 p-6">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-white">Your API key is ready, {result.name.split(" ")[0]}!</div>
                  <div className="text-xs text-white/40 font-mono mt-0.5">This publishable site key is safe to use in your embed tag</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-black/40 rounded-xl border border-white/8 px-4 py-3">
                <code className="flex-1 text-sm font-mono text-emerald-300 break-all">{result.key}</code>
                <CopyButton text={result.key} />
              </div>
            </div>

            {/* Step 2: Install */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full border border-cyan-500 text-cyan-400 text-[10px] font-mono font-bold flex items-center justify-center">2</div>
                <span className="text-sm font-semibold text-white/80">Add the script tag</span>
              </div>
              <p className="text-xs text-white/40 font-mono mb-3">
                Paste this into the <code className="text-white/60">&lt;head&gt;</code> of every page you want personalized:
              </p>
              <CodeBlock code={scriptTag} label="Script tag" />

              <div className="mt-4 p-4 rounded-xl border border-white/6 bg-white/[0.02]">
                <p className="text-xs font-mono text-white/40 mb-1">
                  <span className="text-cyan-400">data-shift-auto="true"</span> automatically rewrites elements with these attributes:
                </p>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {["data-shift-headline", "data-shift-subheadline", "data-shift-cta", "data-shift-conversion"].map(attr => (
                    <code key={attr} className="text-[10px] font-mono bg-white/5 border border-white/8 rounded px-2 py-1 text-white/50 text-center break-all">{attr}</code>
                  ))}
                </div>
              </div>
            </div>

            {/* Full HTML example */}
            <div>
              <p className="text-xs font-mono text-white/30 uppercase tracking-wider mb-3">Full HTML example</p>
              <CodeBlock code={htmlExample} label="HTML" />
            </div>

            {/* JS event example */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Terminal className="w-4 h-4 text-white/30" />
                <p className="text-xs font-mono text-white/30 uppercase tracking-wider">Custom JS hook (optional)</p>
              </div>
              <CodeBlock code={jsExample} label="JavaScript" />
            </div>

            {/* Step 3 */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full border border-indigo-500 text-indigo-400 text-[10px] font-mono font-bold flex items-center justify-center">3</div>
                <span className="text-sm font-semibold text-white/80">Track your visitors</span>
              </div>
              <p className="text-xs text-white/40 font-mono mb-4">
                Visit your dashboard to see real-time persona detection, funnel breakdowns, and conversion tracking for your site.
              </p>
              <Link href="/dashboard">
                <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold transition-all">
                  <BarChart3 className="w-4 h-4" />
                  Open Dashboard
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
