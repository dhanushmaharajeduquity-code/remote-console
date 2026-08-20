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

export default function Dashboard() {
  const [devices, setDevices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>("")
  const [authChecked, setAuthChecked] = useState(false)
  const router = useRouter()

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isTerminalOpen, setIsTerminalOpen] = useState(false)
  
  const [selectedDevice, setSelectedDevice] = useState<any>(null)
  const [detailDevice, setDetailDevice] = useState<any>(null)
  const [terminalDevice, setTerminalDevice] = useState<any>(null)
  
  const [terminalCommand, setTerminalCommand] = useState("")
  const [terminalOutput, setTerminalOutput] = useState("")
  const [terminalLoading, setTerminalLoading] = useState(false)

  const [formData, setFormData] = useState<{ name: string; device_code: string; os: string }>({
    name: "",
    device_code: "",
    os: "Windows 11",
  })
  const [formLoading, setFormLoading] = useState(false)

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
    const { data, error: fetchError } = await supabase.from('devices').select('*').order('id', { ascending: true })
    if (fetchError) setError(`Database Error: ${fetchError.message}`)
    else setDevices(data || [])
    setLoading(false)
  }

  const handleAddDevice = async () => {
    if (!formData.name || !formData.device_code) { setError("Please fill in all required fields."); return }
    setFormLoading(true)
    const { error: insertError } = await supabase.from('devices').insert([{ name: formData.name, device_code: formData.device_code, os: formData.os, status: 'offline' }])
    if (insertError) setError(insertError.code === '23505' ? "Device code already exists!" : `Error: ${insertError.message}`)
    else { setIsAddDialogOpen(false); setFormData({ name: "", device_code: "", os: "Windows 11" }); await fetchDevices() }
    setFormLoading(false)
  }

  const handleEditDevice = async () => {
    if (!selectedDevice) return
    setFormLoading(true)
    const { error: updateError } = await supabase.from('devices').update({ name: formData.name, device_code: formData.device_code, os: formData.os }).eq('id', selectedDevice.id)
    if (updateError) setError(`Error: ${updateError.message}`)
    else { setIsEditDialogOpen(false); setSelectedDevice(null); await fetchDevices() }
    setFormLoading(false)
  }

  const handleDeleteDevice = async () => {
    if (!selectedDevice) return
    setFormLoading(true)
    const { error: deleteError } = await supabase.from('devices').delete().eq('id', selectedDevice.id)
    if (deleteError) setError(`Error: ${deleteError.message}`)
    else { setIsDeleteDialogOpen(false); setSelectedDevice(null); await fetchDevices() }
    setFormLoading(false)
  }

  const openTerminal = (device: any) => {
    setTerminalDevice(device)
    setTerminalCommand("")
    setTerminalOutput("")
    setIsTerminalOpen(true)
  }

  const executeCommand = async () => {
    if (!terminalCommand.trim() || !terminalDevice) return
    setTerminalLoading(true)
    setTerminalOutput("⏳ Sending command to agent...")

    const { data, error } = await supabase.from('commands').insert([{ device_code: terminalDevice.device_code, command_text: terminalCommand, status: 'pending' }]).select().single()
    if (error) { setTerminalOutput(`❌ Error: ${error.message}`); setTerminalLoading(false); return }

    const cmdId = data.id
    const interval = setInterval(async () => {
      const { data: cmdData } = await supabase.from('commands').select('*').eq('id', cmdId).single()
      if (cmdData && cmdData.status !== 'pending' && cmdData.status !== 'running') {
        setTerminalOutput(cmdData.output || "No output returned.")
        setTerminalLoading(false)
        clearInterval(interval)
      }
    }, 1000)

    setTimeout(() => { clearInterval(interval); setTerminalOutput((prev) => prev + "\n⏱️ Timeout waiting for response."); setTerminalLoading(false) }, 35000)
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push("/login"); router.refresh() }

  useEffect(() => {
    checkAuth()
    const channel = supabase.channel('devices_realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => fetchDevices()).subscribe()
    const interval = setInterval(() => setDevices((prev) => [...prev]), 30000)
    return () => { try { supabase.removeChannel(channel) } catch {}; clearInterval(interval) }
  }, [])

  if (!authChecked) return <div className="flex min-h-screen items-center justify-center"><div className="text-lg animate-pulse">Checking authentication...</div></div>

  const totalDevices = devices.length
  const onlineDevices = devices.filter(d => getDeviceStatus(d) === 'online').length
  const offlineDevices = devices.filter(d => getDeviceStatus(d) === 'offline').length

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40 p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight">🖥️ UltraConsole</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">👤 {userEmail}</span>
          <Link href="/logs"><Button variant="outline">📋 Logs</Button></Link>
          <Button variant="outline" onClick={handleLogout}>Logout</Button>
        </div>
      </header>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 flex justify-between items-center">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-red-500 font-bold">✕</button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Devices</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totalDevices}</div></CardContent></Card>
        <Card className="border-green-500/50"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-600">Online</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{onlineDevices}</div></CardContent></Card>
        <Card className="border-red-500/50"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-red-600">Offline</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{offlineDevices}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Managed Devices</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchDevices}>🔄 Refresh</Button>
            <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>+ Add Device</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-center text-muted-foreground py-8">Loading devices...</p> : devices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 px-4">Name</th>
                    <th className="py-2 px-4">Device Code</th>
                    <th className="py-2 px-4">IP Address</th>
                    <th className="py-2 px-4">CPU</th>
                    <th className="py-2 px-4">RAM</th>
                    <th className="py-2 px-4">Status</th>
                    <th className="py-2 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device: any) => (
                    <tr key={device.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 font-medium">{device.name}</td>
                      <td className="py-3 px-4 font-mono text-sm">{device.device_code}</td>
                      <td className="py-3 px-4 font-mono text-sm">{device.ip_address || '—'}</td>
                      <td className="py-3 px-4">
                        {getDeviceStatus(device) === 'online' && device.cpu_usage != null ? (
                          <div className="flex items-center gap-2"><div className="w-16 bg-gray-200 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(device.cpu_usage, 100)}%` }}></div></div><span className="text-xs">{Number(device.cpu_usage).toFixed(0)}%</span></div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        {getDeviceStatus(device) === 'online' && device.ram_usage != null ? (
                          <div className="flex items-center gap-2"><div className="w-16 bg-gray-200 rounded-full h-2"><div className="bg-purple-500 h-2 rounded-full" style={{ width: `${Math.min(device.ram_usage, 100)}%` }}></div></div><span className="text-xs">{Number(device.ram_usage).toFixed(0)}%</span></div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getDeviceStatus(device) === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{getDeviceStatus(device).toUpperCase()}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openTerminal(device)} title="Terminal">💻</Button>
                          <Button variant="ghost" size="sm" onClick={() => { setDetailDevice(device); setIsDetailDialogOpen(true) }} title="Details">👁️</Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedDevice(device); setFormData({ name: device.name || "", device_code: device.device_code || "", os: device.os || "Windows 11" }); setIsEditDialogOpen(true) }} title="Edit">✏️</Button>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => { setSelectedDevice(device); setIsDeleteDialogOpen(true) }} title="Delete">🗑️</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-center text-muted-foreground py-8">No devices found. Run the Python agent to auto-register!</p>}
        </CardContent>
      </Card>

      {/* TERMINAL DIALOG */}
      <Dialog open={isTerminalOpen} onOpenChange={setIsTerminalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>💻 Remote Terminal: {terminalDevice?.name}</DialogTitle>
            <DialogDescription>Execute commands on the remote machine.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex gap-2">
              <Input placeholder="e.g., ipconfig, ls, dir, ping google.com" value={terminalCommand} onChange={(e) => setTerminalCommand(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && executeCommand()} disabled={terminalLoading} />
              <Button onClick={executeCommand} disabled={terminalLoading || !terminalCommand.trim()}>{terminalLoading ? "Running..." : "Run"}</Button>
            </div>
            <div className="bg-black text-green-400 p-4 rounded-md font-mono text-sm h-64 overflow-y-auto whitespace-pre-wrap">
              {terminalOutput || "Awaiting command output..."}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>📋 Device Details</DialogTitle><DialogDescription>System information for {detailDevice?.name || 'Unknown'}</DialogDescription></DialogHeader>
          {detailDevice && (
            <div className="grid gap-3 py-4"><div className="grid grid-cols-2 gap-2 text-sm">
              <span className="font-medium text-muted-foreground">Device Name:</span><span>{detailDevice.name || '—'}</span>
              <span className="font-medium text-muted-foreground">Device Code:</span><span className="font-mono">{detailDevice.device_code || '—'}</span>
              <span className="font-medium text-muted-foreground">Hostname:</span><span className="font-mono">{detailDevice.hostname || '—'}</span>
              <span className="font-medium text-muted-foreground">IP Address:</span><span className="font-mono">{detailDevice.ip_address || '—'}</span>
              <span className="font-medium text-muted-foreground">MAC Address:</span><span className="font-mono">{detailDevice.mac_address || '—'}</span>
              <span className="font-medium text-muted-foreground">OS:</span><span>{detailDevice.os || '—'}</span>
              <span className="font-medium text-muted-foreground">Status:</span><span className={getDeviceStatus(detailDevice) === 'online' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{getDeviceStatus(detailDevice).toUpperCase()}</span>
              <span className="font-medium text-muted-foreground">Last Seen:</span><span>{detailDevice.last_seen ? new Date(detailDevice.last_seen).toLocaleString() : '—'}</span>
            </div></div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Device</DialogTitle><DialogDescription>Register a new device.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Device Name *</Label><Input placeholder="e.g., Office PC" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Device Code *</Label><Input placeholder="e.g., UV-1234" value={formData.device_code} onChange={(e) => setFormData({ ...formData, device_code: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Operating System</Label>
              <Select value={formData.os} onValueChange={(value) => setFormData({ ...formData, os: value || "Windows 11" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Windows 11">Windows 11</SelectItem><SelectItem value="Windows 10">Windows 10</SelectItem><SelectItem value="Ubuntu 22.04">Ubuntu 22.04</SelectItem><SelectItem value="macOS">macOS</SelectItem></SelectContent></Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button><Button onClick={handleAddDevice} disabled={formLoading}>{formLoading ? "Adding..." : "Add Device"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Device</DialogTitle><DialogDescription>Update information.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Device Name *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Device Code *</Label><Input value={formData.device_code} onChange={(e) => setFormData({ ...formData, device_code: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Operating System</Label>
              <Select value={formData.os} onValueChange={(value) => setFormData({ ...formData, os: value || "Windows 11" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Windows 11">Windows 11</SelectItem><SelectItem value="Windows 10">Windows 10</SelectItem><SelectItem value="Ubuntu 22.04">Ubuntu 22.04</SelectItem><SelectItem value="macOS">macOS</SelectItem></SelectContent></Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button><Button onClick={handleEditDevice} disabled={formLoading}>{formLoading ? "Saving..." : "Save Changes"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Device</DialogTitle><DialogDescription>Are you sure you want to delete <strong>{selectedDevice?.name}</strong>?</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button><Button variant="destructive" onClick={handleDeleteDevice} disabled={formLoading}>{formLoading ? "Deleting..." : "Delete"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 	