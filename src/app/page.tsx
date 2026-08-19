import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

// This makes the page fetch real data from the database
export default async function Dashboard() {
  
  // 1. Fetch all devices from Supabase
  const { data: devices } = await supabase.from('devices').select('*')
  
  // 2. Calculate stats
  const totalDevices = devices?.length || 0
  const onlineDevices = devices?.filter(d => d.status === 'online').length || 0
  const offlineDevices = devices?.filter(d => d.status === 'offline').length || 0

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40 p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight">UltraConsole</h1>
        <Button>Add New Device</Button>
      </header>
      
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Devices</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalDevices}</div></CardContent>
        </Card>
        <Card className="border-green-500/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-green-600">Online</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{onlineDevices}</div></CardContent>
        </Card>
        <Card className="border-red-500/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-red-600">Offline</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{offlineDevices}</div></CardContent>
        </Card>
      </div>

      {/* Devices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Managed Devices</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="py-2">Name</th>
                <th className="py-2">Device Code</th>
                <th className="py-2">OS</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {devices?.map((device) => (
                <tr key={device.id} className="border-b hover:bg-muted/50">
                  <td className="py-3 font-medium">{device.name}</td>
                  <td className="py-3 font-mono text-sm">{device.device_code}</td>
                  <td className="py-3">{device.os}</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${device.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {device.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}