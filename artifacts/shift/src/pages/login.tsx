import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Mail, ArrowRight, CheckCircle, ExternalLink, KeyRound, AlertCircle } from "lucide-react";
import { Link } from "wouter";

const API_BASE = "/api";

export default function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [devName, setDevName] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Handle magic link token in URL: /login?token=xxx
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) verifyToken(token);
  }, []);

  const verifyToken = async (token: string) => {
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid or expired login link.");
        setVerifying(false);
        return;
      }
      localStorage.setItem("shift_api_key", data.key);
      localStorage.setItem("shift_api_name", data.name);
      navigate("/dashboard");
    } catch {
      setError("Network error. Please try again.");
      setVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setDevToken(null);
    try {
      const res = await fetch(`${API_BASE}/auth/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      // Dev mode: token returned directly
      if (data._devToken) {
        setDevToken(data._devToken);
        setDevName(data._devName ?? null);
      }
      // If no devToken, just show "check your email" (prod mode)
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
          <p className="text-sm font-mono text-white/40">Verifying your login link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] text-white font-sans flex flex-col">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[250px] bg-indigo-600/6 blur-[100px]" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      </div>

      <header className="relative px-6 py-5 flex justify-between items-center border-b border-white/5">
        <Link href="/">
          <span className="flex items-center gap-2 font-mono font-black tracking-widest text-sm text-cyan-400 cursor-pointer">
            <span className="w-7 h-7 rounded bg-cyan-400 text-black text-xs font-black flex items-center justify-center">S</span>
            SHIFT
          </span>
        </Link>
        <Link href="/start">
          <span className="text-xs font-mono text-white/30 hover:text-white/60 transition-colors cursor-pointer">
            No account? Get started →
          </span>
        </Link>
      </header>

      <main className="relative flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">

          <div className="text-center mb-10">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-5">
              <KeyRound className="w-5 h-5 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-black tracking-tight mb-2">Sign in to Shift</h1>
            <p className="text-sm text-white/35 font-mono">Enter your email to receive a magic login link</p>
          </div>

          {!devToken ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-white/40 mb-1.5 uppercase tracking-wider">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-xs text-red-400 font-mono bg-red-950/30 border border-red-800/30 rounded-xl px-4 py-3">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm transition-all shadow-[0_0_30px_rgba(129,140,248,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Sending link...</>
                ) : (
                  <>Send magic link <ArrowRight className="w-4 h-4" /></>
                )}
              </button>

              <p className="text-center text-[10px] text-white/20 font-mono pt-2">
                Don't have an account?{" "}
                <Link href="/start"><span className="text-cyan-400 hover:text-cyan-300 cursor-pointer">Get a free API key →</span></Link>
              </p>
            </form>
          ) : (
            /* Dev mode: show the magic link directly */
            <div className="space-y-5">
              <div className="rounded-2xl border border-emerald-700/30 bg-emerald-950/20 p-5 text-center">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-white mb-1">
                  {devName ? `Welcome back, ${devName.split(" ")[0]}!` : "Link generated"}
                </p>
                <p className="text-xs text-white/40 font-mono">In production, this link would be sent to <span className="text-white/60">{email}</span></p>
              </div>

              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-3">Your magic login link</p>
                <button
                  onClick={() => verifyToken(devToken)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-sm transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Click to sign in
                </button>
                <p className="text-[10px] font-mono text-white/20 text-center mt-2">Link expires in 30 minutes · One-time use</p>
              </div>

              <button
                onClick={() => { setDevToken(null); setEmail(""); }}
                className="w-full text-xs font-mono text-white/25 hover:text-white/50 transition-colors py-2"
              >
                ← Use a different email
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
