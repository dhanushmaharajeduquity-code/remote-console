'use client'

import { useState, useEffect, useRef, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import Link from "next/link"

// --- EMBEDDED SIDEBAR ---
const menuItems = [
  { href: "/", icon: "📊", label: "Dashboard" },
  { href: "/transfer", icon: "📤", label: "File Transfer" },
  { href: "/logs", icon: "📋", label: "Logs" },
  { href: "/settings", icon: "⚙️", label: "Settings" },
]

function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`flex flex-col h-screen bg-gray-900 text-white transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        {!collapsed ? (
          <div>
            <h1 className="text-lg font-bold">Eduquity</h1>
            <p className="text-xs text-gray-400">Remote Console</p>
          </div>
        ) : <span className="text-xl">🖥️</span>}
        <button onClick={() => setCollapsed(!collapsed)} className="p-1 rounded hover:bg-gray-700">
          {collapsed ? "→" : "←"}
        </button>
      </div>
      <nav className="flex-1 py-4">
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <div className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-lg cursor-pointer transition-colors ${
              pathname === item.href ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800"
            }`}>
              <span className="text-xl">{item.icon}</span>
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </div>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-700">
        {!collapsed && <p className="text-xs text-gray-500 text-center">Eduquity Remote Console v2.0</p>}
      </div>
    </div>
  )
}

interface TransferProgress {
  deviceCode: string
  deviceName: string
  status: string
  progress: number
}

// 👇 RENAMED: This holds all the actual logic
function TransferPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [authChecked, setAuthChecked] = useState(false)
  const [devices, setDevices] = useState<any[]>([])
  const [selectedDevices, setSelectedDevices] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [destinationPath, setDestinationPath] = useState("")
  const [transferProgress, setTransferProgress] = useState<TransferProgress[]>([])
  const [isSending, setIsSending] = useState(false)
  const [status, setStatus] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const CHUNK_SIZE = 64 * 1024

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push("/login"); return }
      setAuthChecked(true)

      const { data } = await supabase.from("devices").select("*").order("id")
      setDevices(data || [])

      const deviceParam = searchParams.get('device')
      if (deviceParam) setSelectedDevices([deviceParam])
    }
    init()
  }, [router, searchParams])

  const toggleDevice = (deviceCode: string) => {
    setSelectedDevices(prev => prev.includes(deviceCode) ? prev.filter(code => code !== deviceCode) : [...prev, deviceCode])
  }

  const selectAll = () => setSelectedDevices(devices.map(d => d.device_code))
  const selectNone = () => setSelectedDevices([])
  const selectOnline = () => {
    const online = devices.filter(d => d.last_seen && (new Date().getTime() - new Date(d.last_seen).getTime()) / 1000 < 60)
    setSelectedDevices(online.map(d => d.device_code))
  }

  const waitForIceGathering = (pc: RTCPeerConnection) => {
    return new Promise<void>((resolve) => {
      if (pc.iceGatheringState === "complete") { resolve(); return }
      const interval = setInterval(() => { if (pc.iceGatheringState === "complete") { clearInterval(interval); resolve() } }, 250)
      setTimeout(() => { clearInterval(interval); resolve() }, 4000)
    })
  }

  const updateProgress = (deviceCode: string, updates: Partial<TransferProgress>) => {
    setTransferProgress(prev => prev.map(p => p.deviceCode === deviceCode ? { ...p, ...updates } : p))
  }

  const sendChunks = async (deviceCode: string, dc: RTCDataChannel, file: File) => {
    let offset = 0
    while (offset < file.size) {
      if (dc.readyState !== "open") { updateProgress(deviceCode, { status: "❌ Connection closed" }); return }
      if (dc.bufferedAmount > CHUNK_SIZE * 50) { await new Promise(resolve => setTimeout(resolve, 50)); continue }
      const chunk = file.slice(offset, offset + CHUNK_SIZE)
      const buffer = await chunk.arrayBuffer()
      dc.send(buffer)
      offset += CHUNK_SIZE
      const percent = Math.min(100, Math.round((offset / file.size) * 100))
      updateProgress(deviceCode, { progress: percent, status: `Sending... ${percent}%` })
    }
    updateProgress(deviceCode, { status: "Waiting for confirmation..." })
  }

  const sendFileToDevice = async (deviceCode: string, deviceName: string, file: File, destination: string) => {
    try {
      updateProgress(deviceCode, { status: "Creating connection...", progress: 0 })
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] })
      const dc = pc.createDataChannel("transfer", { ordered: true })

      dc.onopen = () => {
        updateProgress(deviceCode, { status: "Connected. Sending metadata..." })
        dc.send(JSON.stringify({ type: "file-meta", name: file.name, size: file.size, destination: destination }))
      }

      dc.onmessage = async (event) => {
        if (typeof event.data !== "string") return
        try {
          const message = JSON.parse(event.data)
          if (message.type === "ready") { updateProgress(deviceCode, { status: "Sending file..." }); await sendChunks(deviceCode, dc, file) }
          if (message.type === "file-complete") updateProgress(deviceCode, { status: `✅ Delivered: ${message.path}`, progress: 100 })
          if (message.type === "warning") updateProgress(deviceCode, { status: `⚠️ ${message.message}` })
        } catch {}
      }

      dc.onerror = () => updateProgress(deviceCode, { status: "❌ Connection error" })
      pc.onconnectionstatechange = () => { if (pc.connectionState === "failed" || pc.connectionState === "closed") updateProgress(deviceCode, { status: "❌ Connection failed" }) }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await waitForIceGathering(pc)
      const local = pc.localDescription
      if (!local) { updateProgress(deviceCode, { status: "❌ Failed to create offer" }); return }

      const sessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
      await supabase.from("webrtc_signals").insert([{ session_id: sessionId, device_code: deviceCode, signal_type: "offer", payload: JSON.stringify({ sdp: local.sdp, type: local.type }) }])
      updateProgress(deviceCode, { status: "Waiting for agent response..." })

      let tries = 0
      const interval = setInterval(async () => {
        tries += 1
        const { data } = await supabase.from("webrtc_signals").select("payload").eq("session_id", sessionId).eq("signal_type", "answer").maybeSingle()
        if (data && data.payload) { clearInterval(interval); await pc.setRemoteDescription(JSON.parse(data.payload)); updateProgress(deviceCode, { status: "Connected. Waiting for DataChannel..." }) }
        if (tries > 30) { clearInterval(interval); updateProgress(deviceCode, { status: "❌ Timeout. Is agent running?" }) }
      }, 1000)

    } catch (error: any) { updateProgress(deviceCode, { status: `❌ Error: ${error.message}` }) }
  }

  const handleSendToAll = async () => {
    if (!selectedFile) { setStatus("❌ Select a file first."); return }
    if (selectedDevices.length === 0) { setStatus("❌ Select at least one device."); return }

    setIsSending(true)
    setStatus(`📤 Sending to ${selectedDevices.length} device(s)...`)

    const initialProgress: TransferProgress[] = selectedDevices.map(code => {
      const device = devices.find(d => d.device_code === code)
      return { deviceCode: code, deviceName: device?.custom_label || device?.name || code, status: "Waiting...", progress: 0 }
    })
    setTransferProgress(initialProgress)

    for (const deviceCode of selectedDevices) {
      const device = devices.find(d => d.device_code === deviceCode)
      await sendFileToDevice(deviceCode, device?.name || deviceCode, selectedFile, destinationPath)
    }
    setIsSending(false)
    setStatus("✅ All transfers initiated. Check progress below.")
  }

  if (!authChecked) return <div className="flex min-h-screen items-center justify-center"><div className="animate-pulse">Loading...</div></div>

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">📤 Multi-Agent File Transfer</h1>
          <Link href="/"><Button variant="outline" size="sm">← Back</Button></Link>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>File Selection</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Select File</label>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                  <button className="mt-1 w-full rounded-md border px-3 py-2 hover:bg-gray-50" onClick={() => fileInputRef.current?.click()}>{selectedFile ? selectedFile.name : "Choose File"}</button>
                  {selectedFile && <p className="mt-1 text-xs text-muted-foreground">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>}
                </div>
                <div>
                  <label className="text-sm font-medium">Destination Path on Host</label>
                  <input type="text" className="mt-1 w-full rounded-md border p-2" placeholder="e.g., E:\ or C:\Users\Name\Desktop" value={destinationPath} onChange={(e) => setDestinationPath(e.target.value)} />
                  <p className="mt-1 text-xs text-muted-foreground">Leave empty for default Downloads folder.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Select Devices ({selectedDevices.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Button size="sm" variant="outline" onClick={selectAll}>Select All</Button>
                  <Button size="sm" variant="outline" onClick={selectOnline}>Online Only</Button>
                  <Button size="sm" variant="outline" onClick={selectNone}>Clear</Button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {devices.map((device) => (
                    <label key={device.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={selectedDevices.includes(device.device_code)} onChange={() => toggleDevice(device.device_code)} className="w-4 h-4" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{device.custom_label || device.name}</p>
                        <p className="text-xs text-muted-foreground">{device.device_code}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs ${device.last_seen && (new Date().getTime() - new Date(device.last_seen).getTime()) / 1000 < 60 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {device.last_seen && (new Date().getTime() - new Date(device.last_seen).getTime()) / 1000 < 60 ? 'Online' : 'Offline'}
                      </span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Send</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Button className="w-full" size="lg" onClick={handleSendToAll} disabled={isSending || !selectedFile || selectedDevices.length === 0}>
                  {isSending ? "Sending..." : `🚀 Send to ${selectedDevices.length} Device(s)`}
                </Button>
                {status && <p className="text-sm text-center text-muted-foreground">{status}</p>}
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">Quick Stats</p>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Total Devices: {devices.length}</p>
                    <p>Selected: {selectedDevices.length}</p>
                    <p>File: {selectedFile ? `${(selectedFile.size / (1024*1024)).toFixed(2)} MB` : 'None'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {transferProgress.length > 0 && (
            <Card className="mt-6">
              <CardHeader><CardTitle>Transfer Progress</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {transferProgress.map((progress) => (
                    <div key={progress.deviceCode} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{progress.deviceName}</span>
                        <span className="text-sm text-muted-foreground">{progress.progress}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-200 mb-2"><div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${progress.progress}%` }} /></div>
                      <p className="text-sm text-muted-foreground">{progress.status}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  )
}

// 👇 NEW WRAPPER: This satisfies the Next.js Suspense requirement
export default function TransferPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-lg animate-pulse">Loading Transfer Page...</div>
      </div>
    }>
      <TransferPageContent />
    </Suspense>
  )
}