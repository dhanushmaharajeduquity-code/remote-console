
'use client'

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const menuItems = [
  { href: "/", icon: "📊", label: "Dashboard" },
  { href: "/transfer", icon: "📤", label: "File Transfer" },
  { href: "/devices", icon: "🖥️", label: "Devices" },
  { href: "/terminal", icon: "💻", label: "Terminal" },
  { href: "/screen", icon: "📺", label: "Screen View" },
  { href: "/processes", icon: "⚙️", label: "Processes" },
  { href: "/logs", icon: "📋", label: "Logs" },
  { href: "/settings", icon: "⚙️", label: "Settings" },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`flex flex-col h-screen bg-gray-900 text-white transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        {!collapsed && (
          <div>
            <h1 className="text-lg font-bold">Eduquity</h1>
            <p className="text-xs text-gray-400">Remote Console</p>
          </div>
        )}
        {collapsed && <span className="text-xl">🖥️</span>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-gray-700"
        >
          {collapsed ? "→" : "←"}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <div
              className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-lg cursor-pointer transition-colors ${
                pathname === item.href
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </div>
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        {!collapsed && (
          <p className="text-xs text-gray-500 text-center">
            Eduquity Remote Console v2.0
          </p>
        )}
      </div>
    </div>
  )
}