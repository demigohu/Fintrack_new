"use client"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { Wallet, LogOut } from "lucide-react"

export function ConnectWalletButton() {
  const { isLoggedIn, user, handleLogin, handleLogout, loading } = useAuth()

  if (!isLoggedIn) {
    return (
      <Button onClick={() => void handleLogin()} disabled={loading} className="w-full cursor-pointer bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-700 hover:to-cyan-600 glow-purple hover:animate-pulse-glow transition-all">
        <Wallet className="h-4 w-4 mr-2" />
        <span>Connect Internet Identity</span>
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="text-xs text-slate-300 hidden md:block">{user}</div>
      <Button variant="secondary" onClick={() => void handleLogout()} disabled={loading}>
        <LogOut className="h-4 w-4 mr-2" />
        Logout
      </Button>
    </div>
  )
}


