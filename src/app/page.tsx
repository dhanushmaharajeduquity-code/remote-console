'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

export default function Dashboard() {
  const [devices, setDevices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string>("")

  const fetchDevices = async () => {
    setLoading(true)
    setError(null)

    // Debug: Check if Supabase URL is set
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl || supabaseUrl.includes('dummy')) {
      setError("❌ Supabase URL is not configured! Check Vercel Environment Variables.")
      setLoading(false)
      return
    }

    setDebugInfo(`Connecting to: ${supabaseUrl}`)

    const { data, error: fetchError } = await supabase
      .from('devices')
      .select('*')

    if (fetchError) {
      setError(`Database Error: ${fetchError.message}`)
      console.error("Supabase fetch error:", fetchError)
    } else {
      setDevices(data || [])
      setDebugInfo(`Successfully fetched ${data?.length || 0} devices`)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchDevices()

    const channel = supabase
      .channel('devices_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'devices' },
        () => fetchDevices()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const totalDevices = devices.length
  const onlineDevices = devices.filter(d => d.status === 'online').length
  const offlineDevices = devices.filter(d => d.status === 'offline').length

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg animate-pulse">Loading Dashboard...</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40 p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight">UltraConsole</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchDevices}>
            🔄 Refresh Data
          </Button>
          <Button>Add New Device</Button>
        </div>
      </header>

      {/* DEBUG INFO - Shows what's happening */}
      {debugInfo && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          🔍 {debugInfo}
        </div>
      )}

      {/* ERROR DISPLAY - Shows if something went wrong */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <strong>⚠️ Error:</strong> {error}
          <div className="mt-2 text-sm text-red-600">
            <p>Fix checklist:</p>
            <ul className="list-disc ml-5 mt-1">
              <li>Is RLS disabled? Run: ALTER TABLE devices DISABLE ROW LEVEL SECURITY;</li>
              <li>Are NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY set in Vercel?</li>
              <li>Did you redeploy after adding environment variables?</li>
              <li>Does the table name match exactly? (lowercase "devices")</li>
            </ul>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDevices}</div>
          </CardContent>
        </Card>
        <Card className="border-green-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Online</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{onlineDevices}</div>
          </CardContent>
        </Card>
        <Card className="border-red-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Offline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{offlineDevices}</div>
          </CardContent>
        </Card>
      </div>

      {/* Devices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Managed Devices</CardTitle>
        </CardHeader>
        <CardContent>
          {devices.length > 0 ? (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="py-2 px-4">Name</th>
                  <th className="py-2 px-4">Device Code</th>
                  <th className="py-2 px-4">OS</th>
                  <th className="py-2 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device: any) => (
                  <tr key={device.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-4 font-medium">{device.name}</td>
                    <td className="py-3 px-4 font-mono text-sm">{device.device_code}</td>
                    <td className="py-3 px-4">{device.os}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        device.status === 'online' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {device.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No devices found in database.</p>
              <p className="text-sm text-muted-foreground">
                Make sure you ran the SQL to create and insert data into the "devices" table.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}