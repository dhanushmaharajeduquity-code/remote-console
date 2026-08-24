'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)
  const router = useRouter()

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push("/login"); return }
    setAuthChecked(true)
    fetchLogs()
  }

  const fetchLogs = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('connection_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    setLogs(data || [])
    setLoading(false)
  }

  const getEventIcon = (eventType: string) => {
    if (eventType === 'connect') return '🟢'
    if (eventType === 'disconnect') return '🔴'
    if (eventType === 'error') return '⚠️'
    return '📋'
  }

  useEffect(() => {
    checkAuth()
    const channel = supabase.channel('logs_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connection_logs' }, () => fetchLogs())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  if (!authChecked) return <div className="flex min-h-screen items-center justify-center"><div className="animate-pulse">Loading...</div></div>

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40 p-8">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/"><Button variant="ghost">← Back</Button></Link>
          <h1 className="text-3xl font-bold">📋 Connection Logs</h1>
        </div>
        <Button variant="outline" onClick={fetchLogs}>🔄 Refresh</Button>
      </header>

      <Card>
        <CardHeader><CardTitle>Activity History ({logs.length} events)</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading logs...</p>
          ) : logs.length > 0 ? (
            <div className="space-y-2">
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50">
                  <span className="text-xl">{getEventIcon(log.event_type)}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{log.event_type?.toUpperCase()}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="font-medium">{log.device_name || log.device_code}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{log.details}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-mono text-muted-foreground">{log.ip_address || '—'}</p>
                    <p className="text-xs text-muted-foreground">{log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No logs yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}