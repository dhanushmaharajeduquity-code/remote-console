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

export default function Dashboard() {
  const [devices, setDevices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>("")
  const [authChecked, setAuthChecked] = useState(false)
  const router = useRouter()

  const getDeviceStatus = (device: any) => {
    if (!device.last_seen) return 'offline'
    const lastSeen = new Date(device.last_seen).getTime()
    const now = new Date().getTime()
    const diffInSeconds = (now - lastSeen) / 1000
    if (diffInSeconds > 60) return 'offline'
    return device.status
  }

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<any>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [detailDevice, setDetailDevice] = useState<any>(null)

  const [formData, setFormData] = useState<{ name: string; device_code: string; os: string }>({
    name: "",
    device_code: "",
    os: "Windows 11",
  })

  const [formLoading, setFormLoading] = useState(false)

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push("/login")
      return
    }
    setUserEmail(session.user.email || "")
    setAuthChecked(true)
    fetchDevices()
  }

  const fetchDevices = async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase
      .from('devices')
      .select('*')
      .order('id', { ascending: true })

    if (fetchError) {
      setError(`Database Error: ${fetchError.message}`)
    } else {
      setDevices(data || [])
    }
    setLoading(false)
  }

  const handleAddDevice = async () => {
    if (!formData.name || !formData.device_code) {
      setError("Please fill in all required fields.")
      return
    }
    setFormLoading(true)
    setError(null)

    const { error: insertError } = await supabase
      .from('devices')
      .insert([{ name: formData.name, device_code: formData.device_code, os: formData.os, status: 'offline' }])

    if (insertError) {
      setError(insertError.code === '23505' ? "Device code already exists!" : `Error: ${insertError.message}`)
    } else {
      setIsAddDialogOpen(false)
      setFormData({ name: "", device_code: "", os: "Windows 11" })
      fetchDevices()
    }
    setFormLoading(false)
  }

  const handleEditDevice = async () => {
    if (!selectedDevice) return
    setFormLoading(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('devices')
      .update({ name: formData.name, device_code: formData.device_code, os: formData.os })
      .eq('id', selectedDevice.id)

    if (updateError) {
      setError(`Error: ${updateError.message}`)
    } else {
      setIsEditDialogOpen(false)
      setSelectedDevice(null)
      fetchDevices()
    }
    setFormLoading(false)
  }

  const handleDeleteDevice = async () => {
    if (!selectedDevice) return
    setFormLoading(true)
    setError(null)

    const { error: deleteError } = await supabase
      .from('devices')
      .delete()
      .eq('id', selectedDevice.id)

    if (deleteError) {
      setError(`Error: ${deleteError.message}`)
    } else {
      setIsDeleteDialogOpen(false)
      setSelectedDevice(null)
      fetchDevices()
    }
    setFormLoading(false)
  }

  const openEditDialog = (device: any) => {
    setSelectedDevice(device)
    setFormData({ name: device.name || "", device_code: device.device_code || "", os: device.os || "Windows 11" })
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (device: any) => {
    setSelectedDevice(device)
    setIsDeleteDialogOpen(true)
  }

  const openDetailDialog = (device: any) => {
    setDetailDevice(device)
    setIsDetailDialogOpen(true)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  useEffect(() => {
    checkAuth()

    const channel = supabase
      .channel('devices_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => fetchDevices())
      .subscribe()

    const interval = setInterval(() => {
      setDevices((prev) => [...prev])
    }, 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
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
    <div className="flex min-h-screen w-full flex-col bg-muted/40 p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight">🖥️ UltraConsole</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">👤 {userEmail}</span>
          <Button variant="outline" onClick={handleLogout}>Logout</Button>
        </div>
      </header>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 flex justify-between items-center">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-red-500 font-bold">✕</button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Devices</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalDevices}</div></CardContent>
        </Card>
        <Card className="border-green-500/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-600">Online</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{onlineDevices}</div></CardContent>
        </Card>
        <Card className="border-red-500/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-red-600">Offline</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{offlineDevices}</div></CardContent>
        </Card>
      </div>

      {/* Devices Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Managed Devices</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchDevices}>🔄 Refresh</Button>
            <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>+ Add Device</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading devices...</p>
          ) : devices.length > 0 ? (
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
                        {getDeviceStatus(device) === 'online' ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${device.cpu_usage || 0}%` }}></div>
                            </div>
                            <span className="text-xs">{(device.cpu_usage || 0).toFixed(0)}%</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {getDeviceStatus(device) === 'online' ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${device.ram_usage || 0}%` }}></div>
                            </div>
                            <span className="text-xs">{(device.ram_usage || 0).toFixed(0)}%</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          getDeviceStatus(device) === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {getDeviceStatus(device).toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openDetailDialog(device)} title="View Details">👁️</Button>
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(device)} title="Edit">✏️</Button>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => openDeleteDialog(device)} title="Delete">🗑️</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No devices found. Run the Python agent to auto-register!</p>
          )}
        </CardContent>
      </Card>

      {/* ============ DEVICE DETAIL DIALOG ============ */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>📋 Device Details</DialogTitle>
            <DialogDescription>Full system information for {detailDevice?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="font-medium text-muted-foreground">Device Name:</span>
              <span>{detailDevice?.name}</span>
              <span className="font-medium text-muted-foreground">Device Code:</span>
              <span className="font-mono">{detailDevice?.device_code}</span>
              <span className="font-medium text-muted-foreground">Hostname:</span>
              <span className="font-mono">{detailDevice?.hostname || '—'}</span>
              <span className="font-medium text-muted-foreground">IP Address:</span>
              <span className="font-mono">{detailDevice?.ip_address || '—'}</span>
              <span className="font-medium text-muted-foreground">MAC Address:</span>
              <span className="font-mono">{detailDevice?.mac_address || '—'}</span>
              <span className="font-medium text-muted-foreground">OS:</span>
              <span>{detailDevice?.os || '—'}</span>
              <span className="font-medium text-muted-foreground">CPU Usage:</span>
              <span>{detailDevice?.cpu_usage ? `${detailDevice.cpu_usage.toFixed(1)}%` : '—'}</span>
              <span className="font-medium text-muted-foreground">RAM Usage:</span>
              <span>{detailDevice?.ram_usage ? `${detailDevice.ram_usage.toFixed(1)}%` : '—'}</span>
              <span className="font-medium text-muted-foreground">Status:</span>
              <span className={getDeviceStatus(detailDevice) === 'online' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                {getDeviceStatus(detailDevice).toUpperCase()}
              </span>
              <span className="font-medium text-muted-foreground">Last Seen:</span>
              <span>{detailDevice?.last_seen ? new Date(detailDevice.last_seen).toLocaleString() : '—'}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ ADD DIALOG ============ */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Device</DialogTitle>
            <DialogDescription>Register a new device to manage remotely.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-name">Device Name *</Label>
              <Input id="add-name" placeholder="e.g., Office Reception PC" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-code">Device Code *</Label>
              <Input id="add-code" placeholder="e.g., UV-1234-ABCD" value={formData.device_code} onChange={(e) => setFormData({ ...formData, device_code: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-os">Operating System</Label>
              <Select value={formData.os} onValueChange={(value) => setFormData({ ...formData, os: value || "Windows 11" })}>
                <SelectTrigger id="add-os"><SelectValue placeholder="Select OS" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Windows 11">Windows 11</SelectItem>
                  <SelectItem value="Windows 10">Windows 10</SelectItem>
                  <SelectItem value="Windows Server 2022">Windows Server 2022</SelectItem>
                  <SelectItem value="Windows Server 2019">Windows Server 2019</SelectItem>
                  <SelectItem value="Ubuntu 22.04">Ubuntu 22.04</SelectItem>
                  <SelectItem value="macOS">macOS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddDevice} disabled={formLoading}>{formLoading ? "Adding..." : "Add Device"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ EDIT DIALOG ============ */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Device</DialogTitle>
            <DialogDescription>Update device information.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Device Name *</Label>
              <Input id="edit-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-code">Device Code *</Label>
              <Input id="edit-code" value={formData.device_code} onChange={(e) => setFormData({ ...formData, device_code: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-os">Operating System</Label>
              <Select value={formData.os} onValueChange={(value) => setFormData({ ...formData, os: value || "Windows 11" })}>
                <SelectTrigger id="edit-os"><SelectValue placeholder="Select OS" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Windows 11">Windows 11</SelectItem>
                  <SelectItem value="Windows 10">Windows 10</SelectItem>
                  <SelectItem value="Windows Server 2022">Windows Server 2022</SelectItem>
                  <SelectItem value="Windows Server 2019">Windows Server 2019</SelectItem>
                  <SelectItem value="Ubuntu 22.04">Ubuntu 22.04</SelectItem>
                  <SelectItem value="macOS">macOS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditDevice} disabled={formLoading}>{formLoading ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ DELETE DIALOG ============ */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Device</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedDevice?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteDevice} disabled={formLoading}>{formLoading ? "Deleting..." : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}