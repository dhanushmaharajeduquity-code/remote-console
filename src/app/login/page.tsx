'use client'

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true) // true = login, false = register
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const router = useRouter()

  // Toggle between Login and Register
  const toggleMode = () => {
    setIsLogin(!isLogin)
    setError("")
    setSuccess("")
  }

  // Handle Login
  const handleLogin = async () => {
    setLoading(true)
    setError("")

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
    } else {
      router.push("/")
      router.refresh()
    }
    setLoading(false)
  }

  // Handle Register
  const handleRegister = async () => {
    setError("")
    setSuccess("")

    // Validate password
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
    } else {
      // Check if email confirmation is required
      if (data.session) {
        // Auto-login (email confirmation is OFF)
        router.push("/")
        router.refresh()
      } else {
        setSuccess("✅ Account created! Please check your email to confirm your account, then sign in.")
        setIsLogin(true) // Switch to login mode
      }
    }
    setLoading(false)
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLogin) {
      await handleLogin()
    } else {
      await handleRegister()
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
<CardTitle className="text-2xl font-bold">🖥️ Eduquity Remote Console</CardTitle>
          <CardDescription>
            {isLogin 
              ? "Sign in to manage your remote devices" 
              : "Create a new account to get started"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                ⚠️ {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                {success}
              </div>
            )}

            {/* Email Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Confirm Password (Register mode only) */}
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Confirm Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            )}

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading 
                ? (isLogin ? "Signing in..." : "Creating account...") 
                : (isLogin ? "Sign In" : "Create Account")}
            </Button>
          </form>

          {/* Toggle between Login and Register */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {isLogin ? (
              <p>
                Don&apos;t have an account?{" "}
                <button 
                  onClick={toggleMode} 
                  className="text-primary font-medium hover:underline"
                >
                  Sign Up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button 
                  onClick={toggleMode} 
                  className="text-primary font-medium hover:underline"
                >
                  Sign In
                </button>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
