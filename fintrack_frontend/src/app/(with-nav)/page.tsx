import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { TrendingUp, Shield, ArrowRight, BarChart3, Wallet, PieChart, Target, Zap, Send, ArrowDownToLine, History, CalendarCheck } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-cyber-grid opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <Image
                src="/fintrack.svg"
                alt="FinTrack Logo"
                width={80}
                height={80}
                className="object-contain brightness-0 invert mr-4"
              />
              <h1 className="text-5xl md:text-7xl font-heading font-bold">
                <span className="bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent text-glow">
                  FinTrack
                </span>
              </h1>
            </div>
            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Your comprehensive DeFi portfolio management platform. Track, trade, and optimize your cryptocurrency investments with advanced analytics and seamless cross-chain functionality.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/portfolio">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-700 hover:to-cyan-600 glow-purple hover:animate-pulse-glow text-lg px-8 py-4"
                >
                  View Portfolio
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/trade">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10 hover:glow-purple text-lg px-8 py-4 bg-transparent"
                >
                  Start Trading
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">Complete DeFi Portfolio Management</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Everything you need to manage, track, and optimize your cryptocurrency investments across multiple chains
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 bg-slate-900/50 border-purple-500/20 hover:border-purple-500/40 hover:glow-purple transition-all group">
              <div className="p-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 glow-purple w-fit mb-6 group-hover:animate-pulse-glow">
                <PieChart className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-heading font-semibold text-white mb-4">Portfolio Tracking</h3>
              <p className="text-slate-400">
                Monitor your crypto assets across multiple chains with real-time balance updates and performance analytics.
              </p>
            </Card>

            <Card className="p-8 bg-slate-900/50 border-cyan-500/20 hover:border-cyan-500/40 hover:glow-cyan transition-all group">
              <div className="p-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-500 glow-cyan w-fit mb-6 group-hover:animate-pulse-glow">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-heading font-semibold text-white mb-4">Cross-Chain Trading</h3>
              <p className="text-slate-400">
                Trade cryptocurrencies seamlessly across Bitcoin, Ethereum, and Internet Computer networks.
              </p>
            </Card>

            <Card className="p-8 bg-slate-900/50 border-pink-500/20 hover:border-pink-500/40 hover:glow-pink transition-all group">
              <div className="p-3 rounded-lg bg-gradient-to-r from-pink-600 to-purple-500 glow-pink w-fit mb-6 group-hover:animate-pulse-glow">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-heading font-semibold text-white mb-4">Bridge Assets</h3>
              <p className="text-slate-400">
                Bridge your assets between native and wrapped versions with our secure cross-chain infrastructure.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* FinTrack Features Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">FinTrack Features</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Comprehensive tools for managing your DeFi portfolio
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="p-6 bg-slate-900/50 border-slate-700 hover:border-purple-500/40 hover:glow-purple transition-all group">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-purple-600/20 group-hover:bg-purple-600/30 transition-colors">
                  <BarChart3 className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Portfolio Overview</h3>
                  <p className="text-sm text-slate-400">Track total balance and P&L</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-slate-900/50 border-slate-700 hover:border-cyan-500/40 hover:glow-cyan transition-all group">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-cyan-600/20 group-hover:bg-cyan-600/30 transition-colors">
                  <TrendingUp className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Trading</h3>
                  <p className="text-sm text-slate-400">Swap tokens on Uniswap V3 and KongSwap</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-slate-900/50 border-slate-700 hover:border-pink-500/40 hover:glow-pink transition-all group">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-pink-600/20 group-hover:bg-pink-600/30 transition-colors">
                  <ArrowDownToLine className="h-5 w-5 text-pink-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Deposits</h3>
                  <p className="text-sm text-slate-400">Deposit BTC and ETH and ckAssets</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-slate-900/50 border-slate-700 hover:border-green-500/40 hover:glow-green transition-all group">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-green-600/20 group-hover:bg-green-600/30 transition-colors">
                  <CalendarCheck className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Budgets</h3>
                  <p className="text-sm text-slate-400">Manage spending limits</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-slate-900/50 border-slate-700 hover:border-yellow-500/40 hover:glow-yellow transition-all group">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-yellow-600/20 group-hover:bg-yellow-600/30 transition-colors">
                  <Target className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Goals</h3>
                  <p className="text-sm text-slate-400">Set and track financial goals</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-slate-900/50 border-slate-700 hover:border-blue-500/40 hover:glow-blue transition-all group">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-blue-600/20 group-hover:bg-blue-600/30 transition-colors">
                  <Zap className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Bridge</h3>
                  <p className="text-sm text-slate-400">Cross-chain asset bridging</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-slate-900/50 border-slate-700 hover:border-indigo-500/40 hover:glow-indigo transition-all group">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-indigo-600/20 group-hover:bg-indigo-600/30 transition-colors">
                  <Send className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Transfer</h3>
                  <p className="text-sm text-slate-400">Send assets between accounts</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-slate-900/50 border-slate-700 hover:border-orange-500/40 hover:glow-orange transition-all group">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-orange-600/20 group-hover:bg-orange-600/30 transition-colors">
                  <History className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Transactions</h3>
                  <p className="text-sm text-slate-400">View transaction history</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-slate-900/50 border-slate-700 hover:border-red-500/40 hover:glow-red transition-all group">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-red-600/20 group-hover:bg-red-600/30 transition-colors">
                  <Shield className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Security</h3>
                  <p className="text-sm text-slate-400">Secure wallet integration</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="p-12 rounded-2xl bg-gradient-to-r from-purple-900/20 to-cyan-900/20 border border-purple-500/20 glow-purple">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-6">Ready to Manage Your DeFi Portfolio?</h2>
            <p className="text-slate-300 text-lg mb-8 max-w-2xl mx-auto">
              Start tracking, trading, and optimizing your cryptocurrency investments with FinTrack&apos;s comprehensive DeFi management platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/portfolio">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-700 hover:to-cyan-600 glow-purple hover:animate-pulse-glow text-lg px-8 py-4"
                >
                  <PieChart className="mr-2 h-5 w-5" />
                  View Portfolio
                </Button>
              </Link>
              <Link href="/trade">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10 hover:glow-purple text-lg px-8 py-4 bg-transparent"
                >
                  <TrendingUp className="mr-2 h-5 w-5" />
                  Start Trading
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
