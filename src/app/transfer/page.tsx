'use client'

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function TransferPage() {
  const router = useRouter()

  const [authChecked, setAuthChecked] = useState(false)
  const [devices, setDevices] = useState<any[]>([])
  const [selectedDevice, setSelectedDevice] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [destinationPath, setDestinationPath] = useState("") // NEW: Custom Path State

  const [status, setStatus] = useState("")
  const [progress, setProgress] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [location, setLocation] = useState<any>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)

  // Store both file and destination path while waiting for connection
  const pendingTransferRef = useRef<{ file: File; destination: string } | null>(null)
  const pendingLocationRef = useRef(false)

  const CHUNK_SIZE = 64 * 1024 // 64 KB

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push("/login"); return }
      setAuthChecked(true)
      const { data } = await supabase.from("devices").select("*").order("id", { ascending: true })
      setDevices(data || [])
    }
    init()
  }, [router])

  const waitForIceGathering = (pc: RTCPeerConnection) => {
    return new Promise<void>((resolve) => {
      if (pc.iceGatheringState === "complete") { resolve(); return }
      const interval = setInterval(() => {
        if (pc.iceGatheringState === "complete") { clearInterval(interval); resolve() }
      }, 250)
      setTimeout(() => { clearInterval(interval); resolve() }, 4000)
    })
  }

  const sendFileMeta = (file: File, destination: string) => {
    const dc = dataChannelRef.current
    if (!dc || dc.readyState !== "open") return

    setIsSending(true)
    setProgress(0)
    setStatus("📤 Sending file metadata...")

    dc.send(JSON.stringify({
      type: "file-meta",
      name: file.name,
      size: file.size,
      destination: destination, // Send the custom path
    }))
  }

  const sendFileChunks = async (file: File) => {
    const dc = dataChannelRef.current
    if (!dc) return

    setStatus("📤 Sending file chunks...")
    let offset = 0

    while (offset < file.size) {
      if (dc.readyState !== "open") {
        setStatus("❌ Connection closed during transfer.")
        setIsSending(false)
        return
      }
      if (dc.bufferedAmount > CHUNK_SIZE * 50) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        continue
      }
      const chunk = file.slice(offset, offset + CHUNK_SIZE)
      const buffer = await chunk.arrayBuffer()
      dc.send(buffer)
      offset += CHUNK_SIZE
      setProgress(Math.min(100, Math.round((offset / file.size) * 100)))
    }
    setStatus("✅ All chunks sent. Waiting for host confirmation...")
  }

  const pollForAnswer = (sessionId: string, pc: RTCPeerConnection) => {
    let tries = 0
    const interval = setInterval(async () => {
      tries += 1
      const { data } = await supabase.from("webrtc_signals").select("payload").eq("session_id", sessionId).eq("signal_type", "answer").maybeSingle()
      if (data && data.payload) {
        clearInterval(interval)
        await pc.setRemoteDescription(JSON.parse(data.payload))
        setStatus("🔗 Answer received. Connecting...")
      }
      if (tries > 30) {
        clearInterval(interval)
        setStatus("❌ Timeout waiting for answer. Is webrtc_agent.py running?")
        setIsSending(false)
        setIsLocating(false)
      }
    }, 1000)
  }

  const startConnection = async () => {
    if (!selectedDevice) { setStatus("❌ Select a device first."); return }
    if (peerConnectionRef.current) { try { peerConnectionRef.current.close() } catch {} }

    setStatus("🔄 Creating WebRTC connection...")
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] })
    const dc = pc.createDataChannel("transfer", { ordered: true })

    peerConnectionRef.current = pc
    dataChannelRef.current = dc

    dc.onopen = () => {
      setStatus("✅ Connected to host.")
      if (pendingTransferRef.current) {
        sendFileMeta(pendingTransferRef.current.file, pendingTransferRef.current.destination)
      }
      if (pendingLocationRef.current) {
        dc.send(JSON.stringify({ type: "location-request" }))
        pendingLocationRef.current = false
      }
    }

    dc.onmessage = (event) => {
      if (typeof event.data !== "string") return
      try {
        const message = JSON.parse(event.data)
        if (message.type === "ready" && pendingTransferRef.current) {
          sendFileChunks(pendingTransferRef.current.file)
        }
        if (message.type === "file-complete") {
          setStatus(`✅ File delivered to host: ${message.path}`)
          setProgress(100)
          setIsSending(false)
          pendingTransferRef.current = null
        }
        if (message.type === "warning") {
          setStatus(`⚠️ ${message.message}`)
        }
        if (message.type === "location") {
          setLocation(message)
          setIsLocating(false)
          setStatus("📍 Location received.")
        }
      } catch {}
    }

    pc.onconnectionstatechange = () => {
      setStatus(`🔗 Connection: ${pc.connectionState}`)
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        setIsSending(false)
        setIsLocating(false)
      }
    }

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await waitForIceGathering(pc)
    const local = pc.localDescription
    if (!local) { setStatus("❌ Could not create local description."); return }

    const sessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
    await supabase.from("webrtc_signals").insert([{ session_id: sessionId, device_code: selectedDevice, signal_type: "offer", payload: JSON.stringify({ sdp: local.sdp, type: local.type }) }])
    setStatus("📡 Offer sent. Waiting for host answer...")
    pollForAnswer(sessionId, pc)
  }

  const handleSendFile = async () => {
    if (!selectedDevice) { setStatus("❌ Select a device first."); return }
    if (!selectedFile) { setStatus("❌ Select a file first."); return }

    // Store file and destination path while waiting for connection
    pendingTransferRef.current = { file: selectedFile, destination: destinationPath }

    const dc = dataChannelRef.current
    if (dc && dc.readyState === "open") {
      sendFileMeta(selectedFile, destinationPath)
      return
    }
    const pc = peerConnectionRef.current
    if (!pc || pc.connectionState === "closed" || pc.connectionState === "failed") {
      await startConnection()
    } else {
      setStatus("⏳ Waiting for connection to open. File will send automatically.")
    }
  }

  const handleRequestLocation = async () => {
    if (!selectedDevice) { setStatus("❌ Select a device first."); return }
    setIsLocating(true)
    setLocation(null)
    const dc = dataChannelRef.current
    if (dc && dc.readyState === "open") { dc.send(JSON.stringify({ type: "location-request" })); return }
    pendingLocationRef.current = true
    const pc = peerConnectionRef.current
    if (!pc || pc.connectionState === "closed" || pc.connectionState === "failed") { await startConnection() }
  }

  if (!authChecked) return <div className="flex min-h-screen items-center justify-center"><div className="animate-pulse">Loading...</div></div>

  return (
    <div className="min-h-screen bg-muted/40 p-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/"><button className="rounded-md border px-3 py-2 text-sm">← Back</button></Link>
          <h1 className="text-3xl font-bold">📤 Direct Transfer</h1>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* FILE TRANSFER */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-xl font-semibold">📁 File Transfer</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Device</label>
              <select className="mt-1 w-full rounded-md border p-2" value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)}>
                <option value="">Select device</option>
                {devices.map((device) => (<option key={device.id} value={device.device_code}>{device.name} ({device.device_code})</option>))}
              </select>
            </div>

            {/* NEW: Destination Path Input */}
            <div>
              <label className="text-sm font-medium">Destination Path on Host</label>
              <input
                type="text"
                className="mt-1 w-full rounded-md border p-2"
                placeholder="e.g., E:\ or E:\console remote\agent\dist"
                value={destinationPath}
                onChange={(e) => setDestinationPath(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">Leave empty to use the default Downloads folder.</p>
            </div>

            <div>
              <label className="text-sm font-medium">File</label>
              <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
              <button className="mt-1 w-full rounded-md border px-3 py-2" onClick={() => fileInputRef.current?.click()}>
                {selectedFile ? selectedFile.name : "Choose File"}
              </button>
              {selectedFile && <p className="mt-1 text-xs text-muted-foreground">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>}
            </div>

            <button className="w-full rounded-md bg-blue-600 px-3 py-2 text-white disabled:opacity-50" onClick={handleSendFile} disabled={isSending || !selectedFile || !selectedDevice}>
              {isSending ? "Sending..." : "Send File Directly"}
            </button>

            {progress > 0 && (
              <div>
                <div className="mb-1 flex justify-between text-sm"><span>Progress</span><span>{progress}%</span></div>
                <div className="h-2 w-full rounded-full bg-gray-200"><div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} /></div>
              </div>
            )}
          </div>
        </div>

        {/* LOCATION */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-xl font-semibold">📍 Host Location</h2>
          <button className="w-full rounded-md bg-green-600 px-3 py-2 text-white disabled:opacity-50" onClick={handleRequestLocation} disabled={isLocating || !selectedDevice}>
            {isLocating ? "Requesting..." : "Get Host Location"}
          </button>
          {location && (
            <div className="mt-4 space-y-2 rounded-md bg-muted p-4 text-sm">
              <p><strong>IP:</strong> {location.ip || "N/A"}</p>
              <p><strong>City:</strong> {location.city || "N/A"}</p>
              <p><strong>Country:</strong> {location.country || "N/A"}</p>
              <p><strong>Lat/Lng:</strong> {location.lat}, {location.lng}</p>
              {location.lat && location.lng && (
                <a href={`https://www.google.com/maps?q=${location.lat},${location.lng}`} target="_blank" rel="noopener noreferrer" className="block text-blue-600 underline">Open in Google Maps</a>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-lg border bg-card p-4">
        <p className="text-sm font-medium">Status: {status || "Idle"}</p>
      </div>
    </div>
  )
}