"use client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Zap, ArrowRight, Shield, Fingerprint, Wallet2, Smartphone } from "lucide-react"

export default function LoginPage() {
  const handleWalletConnect = (walletType: string) => {
    // Handle wallet connection logic here
    console.log("Connecting to:", walletType)
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-900">
        <div className="absolute inset-0 bg-cyber-grid opacity-10"></div>

        {/* Floating Orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 right-1/3 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Login Form */}
      <div className="relative z-10 w-full max-w-md px-6">
        <Card className="p-8 bg-slate-900/80 backdrop-blur-xl border-purple-500/20 glow-purple">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 glow-purple animate-pulse-glow">
                <Zap className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-heading font-bold text-white mb-2">Connect Your Wallet</h1>
            <p className="text-slate-400">
              Access <span className="text-cyan-400 font-semibold">CyberTrade</span> with your crypto wallet
            </p>
          </div>

          {/* Wallet Connection Options */}
          <div className="space-y-4">
            <Button
              onClick={() => handleWalletConnect("MetaMask")}
              className="w-full h-14 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 glow-orange hover:animate-pulse-glow text-white font-semibold transition-all duration-200 group"
            >
              <Shield className="h-6 w-6 mr-3 group-hover:scale-110 transition-transform" />
              <div className="flex flex-col items-start">
                <span className="text-lg">MetaMask</span>
                <span className="text-xs opacity-80">Most popular wallet</span>
              </div>
              <ArrowRight className="ml-auto h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>

            <Button
              onClick={() => handleWalletConnect("WalletConnect")}
              className="w-full h-14 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 glow-blue hover:animate-pulse-glow text-white font-semibold transition-all duration-200 group"
            >
              <Fingerprint className="h-6 w-6 mr-3 group-hover:scale-110 transition-transform" />
              <div className="flex flex-col items-start">
                <span className="text-lg">WalletConnect</span>
                <span className="text-xs opacity-80">Connect any wallet</span>
              </div>
              <ArrowRight className="ml-auto h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>

            <Button
              onClick={() => handleWalletConnect("Coinbase")}
              className="w-full h-14 bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-700 hover:to-cyan-600 glow-purple hover:animate-pulse-glow text-white font-semibold transition-all duration-200 group"
            >
              <Wallet2 className="h-6 w-6 mr-3 group-hover:scale-110 transition-transform" />
              <div className="flex flex-col items-start">
                <span className="text-lg">Coinbase Wallet</span>
                <span className="text-xs opacity-80">Secure & easy</span>
              </div>
              <ArrowRight className="ml-auto h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>

            <Button
              onClick={() => handleWalletConnect("Mobile")}
              variant="outline"
              className="w-full h-14 border-slate-600 bg-slate-800/50 hover:bg-slate-700/50 hover:border-purple-500/50 text-slate-300 hover:text-white transition-all duration-200 group"
            >
              <Smartphone className="h-6 w-6 mr-3 group-hover:scale-110 transition-transform" />
              <div className="flex flex-col items-start">
                <span className="text-lg">Mobile Wallet</span>
                <span className="text-xs opacity-80">Trust, Rainbow & more</span>
              </div>
              <ArrowRight className="ml-auto h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-900 text-slate-400">New to crypto?</span>
            </div>
          </div>

          {/* Learn More Link */}
          <div className="text-center">
            <Link
              href="/learn"
              className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors inline-flex items-center"
            >
              Learn about crypto wallets
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </Card>

        {/* Security Notice */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">Your wallet connection is secured with industry-standard encryption</p>
        </div>
      </div>
    </div>
  )
}
