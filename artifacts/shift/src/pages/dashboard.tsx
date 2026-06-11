import { useEffect } from "react";
import { Link } from "wouter";
import { 
  useGetDashboardStats, 
  useGetFunnelBreakdown, 
  useGetRecentActivity,
  getGetDashboardStatsQueryKey,
  getGetFunnelBreakdownQueryKey,
  getGetRecentActivityQueryKey
} from "@workspace/api-client-react";
import { 
  ArrowLeft, 
  Users, 
  MousePointerClick, 
  Percent, 
  Clock, 
  Activity,
  User,
  MapPin,
  Laptop
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: stats } = useGetDashboardStats({
    query: { refetchInterval: 15000, queryKey: getGetDashboardStatsQueryKey() }
  });
  
  const { data: funnel } = useGetFunnelBreakdown({
    query: { refetchInterval: 15000, queryKey: getGetFunnelBreakdownQueryKey() }
  });
  
  const { data: recent } = useGetRecentActivity({
    query: { refetchInterval: 15000, queryKey: getGetRecentActivityQueryKey() }
  });

  return (
    <div className="min-h-screen w-full bg-background text-foreground p-6 md:p-12 font-sans">
      <header className="max-w-7xl mx-auto flex items-center justify-between mb-12">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
            <Activity className="w-8 h-8 text-primary" />
            Visitor Intelligence
          </h1>
          <p className="text-muted-foreground font-mono text-sm">Real-time telemetry and personalization engine</p>
        </div>
        <Link href="/" className="flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors border px-4 py-2 rounded-md bg-card/50">
          <ArrowLeft className="w-4 h-4" />
          Live Site
        </Link>
      </header>

      <main className="max-w-7xl mx-auto space-y-8">
        
        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-mono text-muted-foreground">Total Visitors</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.totalVisitors || 0}</div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {stats?.todayVisitors || 0} today
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-mono text-muted-foreground">Conversions</CardTitle>
              <MousePointerClick className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats?.totalConverted || 0}</div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {stats?.todayConverted || 0} today
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-mono text-muted-foreground">Conv. Rate</CardTitle>
              <Percent className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{((stats?.conversionRate || 0) * 100).toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                Average across all
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-mono text-muted-foreground">Avg Time</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{Math.round(stats?.avgTimeOnSite || 0)}s</div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                Seconds per session
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Funnel Breakdown */}
          <Card className="lg:col-span-1 bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Persona Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {funnel?.map((f) => (
                <div key={f.persona} className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium">{f.persona}</span>
                    <span className="font-mono text-muted-foreground">{f.count} sessions</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-primary" 
                      style={{ width: `${(f.count / Math.max(stats?.totalVisitors || 1, 1)) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs font-mono text-muted-foreground">
                    <span>{((f.conversionRate || 0) * 100).toFixed(1)}% conv.</span>
                    <span>{Math.round((f.avgConfidence || 0) * 100)}% conf.</span>
                  </div>
                </div>
              ))}
              {(!funnel || funnel.length === 0) && (
                <div className="text-center py-8 text-sm text-muted-foreground font-mono">
                  No data available yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card className="lg:col-span-2 bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Live Telemetry</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recent?.map((visitor) => (
                  <div key={visitor.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border/40 bg-background/40 gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 p-2 bg-secondary rounded-md">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-muted-foreground">
                            {visitor.sessionId.split('-')[0]}
                          </span>
                          <Badge variant="outline" className="font-mono text-[10px] uppercase bg-primary/10 text-primary border-primary/20">
                            {visitor.persona} ({Math.round((visitor.personaConfidence || 0) * 100)}%)
                          </Badge>
                          {visitor.converted && (
                            <Badge variant="default" className="font-mono text-[10px] uppercase">
                              Converted
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                          {visitor.referrer && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {new URL(visitor.referrer).hostname}
                            </span>
                          )}
                          {visitor.deviceType && (
                            <span className="flex items-center gap-1">
                              <Laptop className="w-3 h-3" />
                              {visitor.deviceType}
                            </span>
                          )}
                          {visitor.utmSource && (
                            <span className="font-mono bg-secondary px-1.5 py-0.5 rounded text-[10px]">
                              utm_source={visitor.utmSource}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="text-xs text-muted-foreground font-mono mb-1">
                        {new Date(visitor.createdAt).toLocaleTimeString()}
                      </span>
                      {visitor.timeOnSite && (
                        <span className="text-xs font-mono text-muted-foreground">
                          {visitor.timeOnSite}s duration
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {(!recent || recent.length === 0) && (
                  <div className="text-center py-12 text-sm text-muted-foreground font-mono">
                    Waiting for signals...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}
