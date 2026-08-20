'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function Dashboard() {
  const [devices, setDevices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>("")
  const [authChecked, setAuthChecked] = useState(false)
  const router = useRouter()

  // 1. Check if user is logged in
  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      // Not logged in → redirect to login page
      router.push("/login")
      return
    }
    
    setUserEmail(session.user.email || "")
    setAuthChecked(true)
    fetchDevices()
  }

  // 2. Fetch devices from database
  const fetchDevices = async () => {
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('devices')
      .select('*')

    if (fetchError) {
      setError(`Database Error: ${fetchError.message}`)
    } else {
      setDevices(data || [])
    }
    setLoading(false)
  }

  // 3. Logout function
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  // 4. Run auth check on page load
  useEffect(() => {
    checkAuth()

    // Set up realtime listener
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

  // Show loading while checking auth
  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg animate-pulse">Checking authentication...</div>
      </div>
    )
  }

  const totalDevices = devices.length
  const onlineDevices = devices.filter(d => d.status === 'online').length
  const offlineDevices = devices.filter(d => d.status === 'offline').length

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40 p-8">
      {/* Header with User Info and Logout */}
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight">🖥️ UltraConsole</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            👤 {userEmail}
          </span>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <strong>⚠️ Error:</strong> {error}
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Managed Devices</CardTitle>
          <Button size="sm" variant="outline" onClick={fetchDevices}>
            🔄 Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading devices...</p>
          ) : devices.length > 0 ? (
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
            <p className="text-center text-muted-foreground py-8">No devices found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
