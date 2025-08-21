"use client"

import { useEffect, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { TrendingUp, TrendingDown, DollarSign, Percent, RefreshCw } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { balanceService, currencyService } from "@/services/backend"

type PortfolioStats = {
  title: string
  value: string
  change: string
  changePercent: string
  isPositive: boolean | null
  icon: any
}

export function PortfolioOverview() {
  const { isLoggedIn } = useAuth()
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStats[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!isLoggedIn) return
    setLoading(true)
    setError(null)
    
    try {
      // Ambil ringkasan saldo gabungan (ck + native)
      const portfolioRes = await balanceService.getPortfolioSummary()
      if (!portfolioRes.success) {
        setError("Failed to load portfolio summary")
        return
      }
      const sum = portfolioRes.data as any
      const ckbtcSats = Number(sum.ckbtc_balance ?? 0)
      const ckethWei = Number(sum.cketh_balance ?? 0)
      const btcNativeSats = Number(sum.btc_native_balance ?? 0)
      const ethNativeWei = Number(sum.eth_native_balance ?? 0)

      const btcBalance = (ckbtcSats + btcNativeSats) / 1e8
      const ethBalance = (ckethWei + ethNativeWei) / 1e18
      
      // Get live USD rates from backend
      const ratesRes = await currencyService.getCurrencyRates()
      if (!ratesRes.success) {
        setError("Failed to load rates")
        return
      }
      const btcPrice = ratesRes.data.btc_to_usd
      const ethPrice = ratesRes.data.eth_to_usd
      
      const btcValue = isFinite(btcBalance) ? btcBalance * btcPrice : 0
      const ethValue = isFinite(ethBalance) ? ethBalance * ethPrice : 0
      const totalValue = (isFinite(btcValue) ? btcValue : 0) + (isFinite(ethValue) ? ethValue : 0)
      
      // Calculate 24h change (still mock for now)
      const yesterdayValue = totalValue * 0.98
      const change24h = totalValue - yesterdayValue
      const changePercent24h = yesterdayValue !== 0 ? ((change24h / yesterdayValue) * 100) : 0
      
      // Calculate total P&L (mock for now)
      const initialValue = totalValue * 0.7
      const totalPnL = totalValue - initialValue
      const totalPnLPercent = initialValue !== 0 ? ((totalPnL / initialValue) * 100) : 0
      
      const stats: PortfolioStats[] = [
        {
          title: "Total Balance",
          value: `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          change: `$${change24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          changePercent: `${changePercent24h >= 0 ? '+' : ''}${changePercent24h.toFixed(2)}%`,
          isPositive: change24h >= 0,
          icon: DollarSign,
        },
        {
          title: "24h Change",
          value: `${change24h >= 0 ? '+' : ''}$${change24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          change: `${changePercent24h >= 0 ? '+' : ''}${changePercent24h.toFixed(2)}%`,
          changePercent: "vs yesterday",
          isPositive: change24h >= 0,
          icon: TrendingUp,
        },
        {
          title: "Total P&L",
          value: `${totalPnL >= 0 ? '+' : ''}$${totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          change: `${totalPnLPercent >= 0 ? '+' : ''}${totalPnLPercent.toFixed(2)}%`,
          changePercent: "all time",
          isPositive: totalPnL >= 0,
          icon: Percent,
        },
        {
          title: "Available Balance",
          value: `${btcBalance.toFixed(4)} BTC + ${ethBalance.toFixed(4)} ETH`,
          change: `ckBTC: ${(ckbtcSats/1e8).toFixed(4)} • BTC: ${(btcNativeSats/1e8).toFixed(4)}  |  ckETH: ${(ckethWei/1e18).toFixed(4)} • ETH: ${(ethNativeWei/1e18).toFixed(4)}`,
          changePercent: "Breakdown",
          isPositive: null,
          icon: DollarSign,
        },
      ]
      
      setPortfolioStats(stats)
    } catch (e: any) {
      setError(e?.message || "Failed to load portfolio data")
    } finally {
      setLoading(false)
    }
  }, [isLoggedIn])

  useEffect(() => {
    void loadData()
  }, [loadData])

  if (!isLoggedIn) {
    return (
      <div className="text-slate-400 text-center py-8">
        Silakan login terlebih dahulu
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-400 text-center py-8">
        Error: {error}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-slate-400 text-center py-8">
        Memuat portfolio...
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Portfolio Overview</h2>
        <button
          onClick={() => void loadData()}
          className="p-2 text-slate-400 hover:text-white transition-colors"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {portfolioStats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card
              key={index}
              className="p-6 bg-slate-900/80 border-purple-500/20 hover:border-purple-500/40 hover:glow-purple transition-all group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 glow-purple group-hover:animate-pulse-glow">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                {stat.isPositive !== null && (
                  <div className={`flex items-center ${stat.isPositive ? "text-green-400" : "text-red-400"}`}>
                    {stat.isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-sm text-slate-400">{stat.title}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <div className="flex items-center justify-between text-sm">
                  <span
                    className={
                      stat.isPositive ? "text-green-400" : stat.isPositive === false ? "text-red-400" : "text-slate-400"
                    }
                  >
                    {stat.change}
                  </span>
                  <span className="text-slate-500">{stat.changePercent}</span>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
