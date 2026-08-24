'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Sidebar from "@/components/Sidebar"

export default function Dashboard() {
  const [devices, setDevices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>("")
  const [authChecked, setAuthChecked] = useState(false)
  const router = useRouter()

  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false)
  const [configDevice, setConfigDevice] = useState<any>(null)
  const [deviceConfig, setDeviceConfig] = useState<any>({
    default_download_path: "",
    heartbeat_interval: 10,
    auto_start: false,
    allow_terminal: true,
    allow_file_transfer: true,
    allow_screen_share: true,
    allow_power_control: true,
    allow_process_manager: true,
    notification_enabled: true,
    custom_label: "",
    group_name: "Default",
  })

  const getDeviceStatus = (device: any) => {
    try {
      if (!device || !device.last_seen) return 'offline'
      const diffInSeconds = (new Date().getTime() - new Date(device.last_seen).getTime()) / 1000
      if (diffInSeconds > 60) return 'offline'
      return device.status || 'offline'
    } catch { return 'offline' }
  }

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push("/login"); return }
    setUserEmail(session.user.email || "")
    setAuthChecked(true)
    await fetchDevices()
  }

  const fetchDevices = async () => {
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('devices')
      .select('*')
      .order('id', { ascending: true })

    if (fetchError) setError(`Database Error: ${fetchError.message}`)
    else setDevices(data || [])
    setLoading(false)
  }

  const openConfigDialog = async (device: any) => {
    setConfigDevice(device)
    
    // Fetch existing config or create default
    const { data } = await supabase
      .from('device_configs')
      .select('*')
      .eq('device_code', device.device_code)
      .maybeSingle()

    if (data) {
      setDeviceConfig(data)
    } else {
      setDeviceConfig({
        device_code: device.device_code,
        default_download_path: "",
        heartbeat_interval: 10,
        auto_start: false,
        allow_terminal: true,
        allow_file_transfer: true,
        allow_screen_share: true,
        allow_power_control: true,
        allow_process_manager: true,
        notification_enabled: true,
        custom_label: device.name || "",
        group_name: "Default",
      })
    }
    setIsConfigDialogOpen(true)
  }

  const saveConfig = async () => {
    if (!configDevice) return

    const { error } = await supabase
      .from('device_configs')
      .upsert({
        device_code: configDevice.device_code,
        default_download_path: deviceConfig.default_download_path,
        heartbeat_interval: deviceConfig.heartbeat_interval,
        auto_start: deviceConfig.auto_start,
        allow_terminal: deviceConfig.allow_terminal,
        allow_file_transfer: deviceConfig.allow_file_transfer,
        allow_screen_share: deviceConfig.allow_screen_share,
        allow_power_control: deviceConfig.allow_power_control,
        allow_process_manager: deviceConfig.allow_process_manager,
        notification_enabled: deviceConfig.notification_enabled,
        custom_label: deviceConfig.custom_label,
        group_name: deviceConfig.group_name,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'device_code' })

    if (error) {
      setError(`Failed to save config: ${error.message}`)
    } else {
      setIsConfigDialogOpen(false)
      setError(null)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  useEffect(() => {
    checkAuth()
    const interval = setInterval(() => setDevices(prev => [...prev]), 30000)
    return () => clearInterval(interval)
  }, [])

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg animate-pulse">Checking authentication...</div>
      </div>
    )
  }

  const totalDevices = devices.length
  const onlineDevices = devices.filter(d => getDeviceStatus(d) === 'online').length
  const offlineDevices = devices.filter(d => getDeviceStatus(d) === 'offline').length

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">👤 {userEmail}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>Logout</Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              ⚠️ {error}
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Total Devices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalDevices}</div>
              </CardContent>
            </Card>
            <Card className="border-green-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-600">Online</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{onlineDevices}</div>
              </CardContent>
            </Card>
            <Card className="border-red-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-600">Offline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">{offlineDevices}</div>
              </CardContent>
            </Card>
            <Card className="border-blue-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-600">Groups</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {new Set(devices.map(d => d.group_name || 'Default')).size}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Devices Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Managed Devices</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchDevices}>🔄 Refresh</Button>
                <Link href="/transfer">
                  <Button size="sm">📤 Transfer Files</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Loading...</p>
              ) : devices.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="py-3 px-4 font-medium">Name</th>
                        <th className="py-3 px-4 font-medium">Code</th>
                        <th className="py-3 px-4 font-medium">Group</th>
                        <th className="py-3 px-4 font-medium">IP</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                        <th className="py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {devices.map((device: any) => (
                        <tr key={device.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 font-medium">{device.custom_label || device.name}</td>
                          <td className="py-3 px-4 font-mono text-sm">{device.device_code}</td>
                          <td className="py-3 px-4 text-sm">{device.group_name || 'Default'}</td>
                          <td className="py-3 px-4 font-mono text-sm">{device.ip_address || '—'}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              getDeviceStatus(device) === 'online' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {getDeviceStatus(device).toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openConfigDialog(device)} title="Configure">
                                ⚙️
                              </Button>
                              <Link href={`/transfer?device=${device.device_code}`}>
                                <Button variant="ghost" size="sm" title="Transfer">📤</Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No devices found.</p>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Configuration Dialog */}
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>⚙️ Device Configuration</DialogTitle>
            <DialogDescription>
              Configure settings for {configDevice?.name} ({configDevice?.device_code})
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Custom Label</Label>
              <Input
                value={deviceConfig.custom_label || ""}
                onChange={(e) => setDeviceConfig({ ...deviceConfig, custom_label: e.target.value })}
                placeholder="e.g., Office PC 01"
              />
            </div>

            <div className="grid gap-2">
              <Label>Group Name</Label>
              <Input
                value={deviceConfig.group_name || ""}
                onChange={(e) => setDeviceConfig({ ...deviceConfig, group_name: e.target.value })}
                placeholder="e.g., Office, Warehouse"
              />
            </div>

            <div className="grid gap-2">
              <Label>Default Download Path</Label>
              <Input
                value={deviceConfig.default_download_path || ""}
                onChange={(e) => setDeviceConfig({ ...deviceConfig, default_download_path: e.target.value })}
                placeholder="e.g., E:\Downloads"
              />
            </div>

            <div className="grid gap-2">
              <Label>Heartbeat Interval (seconds)</Label>
              <Input
                type="number"
                value={deviceConfig.heartbeat_interval || 10}
                onChange={(e) => setDeviceConfig({ ...deviceConfig, heartbeat_interval: parseInt(e.target.value) || 10 })}
              />
            </div>

            <div className="space-y-3 border-t pt-4">
              <h4 className="font-semibold">Permissions</h4>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={deviceConfig.allow_terminal}
                  onChange={(e) => setDeviceConfig({ ...deviceConfig, allow_terminal: e.target.checked })}
                />
                Allow Terminal Commands
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={deviceConfig.allow_file_transfer}
                  onChange={(e) => setDeviceConfig({ ...deviceConfig, allow_file_transfer: e.target.checked })}
                />
                Allow File Transfer
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={deviceConfig.allow_screen_share}
                  onChange={(e) => setDeviceConfig({ ...deviceConfig, allow_screen_share: e.target.checked })}
                />
                Allow Screen Share
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={deviceConfig.allow_power_control}
                  onChange={(e) => setDeviceConfig({ ...deviceConfig, allow_power_control: e.target.checked })}
                />
                Allow Power Control
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={deviceConfig.allow_process_manager}
                  onChange={(e) => setDeviceConfig({ ...deviceConfig, allow_process_manager: e.target.checked })}
                />
                Allow Process Manager
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={deviceConfig.notification_enabled}
                  onChange={(e) => setDeviceConfig({ ...deviceConfig, notification_enabled: e.target.checked })}
                />
                Enable Notifications
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveConfig}>Save Configuration</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}