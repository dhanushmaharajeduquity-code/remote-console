'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

export default function Dashboard() {
  const [devices, setDevices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Function to fetch data from the database
  const fetchDevices = async () => {
    const { data } = await supabase.from('devices').select('*')
    setDevices(data || [])
    setLoading(false)
  }

  useEffect(() => {
    // 1. Load data when the page opens
    fetchDevices()

    // 2. Listen for live changes from the Python Agent
    const channel = supabase
      .channel('devices_realtime')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'devices' }, 
        () => {
          console.log("Database changed! Updating dashboard...")
          fetchDevices()
        }
      )
      .subscribe()

    // Cleanup listener when leaving the page
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const totalDevices = devices.length
  const onlineDevices = devices.filter(d => d.status === 'online').length
  const offlineDevices = devices.filter(d => d.status === 'offline').length

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-lg">Loading Dashboard...</div>
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40 p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight">UltraConsole</h1>
        <Button>Add New Device</Button>
      </header>
      
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
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${device.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {device.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-center text-muted-foreground py-8">No devices found in database.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
