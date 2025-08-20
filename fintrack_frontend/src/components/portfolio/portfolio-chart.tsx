"use client"

import { useEffect, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart3, TrendingUp, RefreshCw } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useAuth } from "@/contexts/AuthContext"
import { bitcoinService, ethereumService, currencyService } from "@/services/backend"

type PortfolioData = {
  date: string
  value: number
  change: number
}

export function PortfolioChart() {
  const { isLoggedIn } = useAuth()
  const [portfolioData, setPortfolioData] = useState<PortfolioData[]>([])
  const [totalValue, setTotalValue] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const timeframes = ["24H", "7D", "1M", "3M", "1Y", "ALL"]

  const loadData = useCallback(async () => {
    if (!isLoggedIn) return
    setLoading(true)
    setError(null)
    
    try {
      // Get BTC and ETH balances
      const btcRes = await bitcoinService.getBtcBalance()
      const ethRes = await ethereumService.getEthBalance()
      
      if (!btcRes.success || !ethRes.success) {
        setError("Failed to load balance data")
        return
      }
      
      const btcSats = typeof btcRes.data === "bigint" ? Number(btcRes.data) : Number(btcRes.data ?? 0)
      const ethWei = typeof ethRes.data === "bigint" ? Number(ethRes.data) : Number(ethRes.data ?? 0)
      const btcBalance = btcSats / 100000000 // Convert satoshis to BTC
      const ethBalance = ethWei / 1000000000000000000 // Convert wei to ETH
      
      // Live USD rates from backend
      const ratesRes = await currencyService.getCurrencyRates()
      if (!ratesRes.success) {
        setError("Failed to load rates")
        return
      }
      const btcPrice = ratesRes.data.btc_to_usd
      const ethPrice = ratesRes.data.eth_to_usd
      
      const btcValue = btcBalance * btcPrice
      const ethValue = ethBalance * ethPrice
      const currentValue = btcValue + ethValue
      
      setTotalValue(currentValue)
      
      // Generate mock historical data based on current value
      const mockData: PortfolioData[] = [
        { date: "Jan 1", value: currentValue * 0.8, change: 0 },
        { date: "Jan 5", value: currentValue * 0.85, change: currentValue * 0.05 },
        { date: "Jan 10", value: currentValue * 0.9, change: currentValue * 0.1 },
        { date: "Jan 15", value: currentValue * 0.95, change: currentValue * 0.15 },
        { date: "Jan 20", value: currentValue * 1.0, change: currentValue * 0.2 },
        { date: "Jan 25", value: currentValue * 1.05, change: currentValue * 0.25 },
        { date: "Jan 30", value: currentValue, change: currentValue * 0.2 },
      ]
      
      setPortfolioData(mockData)
    } catch (e: any) {
      setError(e?.message || "Failed to load chart data")
    } finally {
      setLoading(false)
    }
  }, [isLoggedIn])

  useEffect(() => {
    void loadData()
  }, [loadData])

  if (!isLoggedIn) {
    return (
      <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
        <div className="text-slate-400 text-center py-8">
          Silakan login terlebih dahulu
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
        <div className="text-red-400 text-center py-8">
          Error: {error}
        </div>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className="p-6 bg-slate-500/20 glow-purple">
        <div className="text-slate-400 text-center py-8">
          Memuat chart...
        </div>
      </Card>
    )
  }

  if (portfolioData.length === 0) {
    return (
      <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
        <div className="text-slate-400 text-center py-8">
          Tidak ada data untuk ditampilkan
        </div>
      </Card>
    )
  }

  const totalChange = portfolioData[portfolioData.length - 1]?.change || 0
  const changePercent = totalValue > 0 ? ((totalChange / (totalValue - totalChange)) * 100) : 0

  return (
    <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
      {/* Chart Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-purple-400" />
            <span className="font-heading font-semibold text-white text-lg">Portfolio Performance</span>
          </div>
          <div className="flex items-center space-x-2 text-green-400">
            <TrendingUp className="h-4 w-4" />
            <span className="font-semibold">+{changePercent.toFixed(2)}%</span>
            <span className="text-sm">All Time</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex bg-slate-800/50 rounded-lg p-1">
            {timeframes.map((tf) => (
              <Button
                key={tf}
                variant="ghost"
                size="sm"
                className={`px-3 py-1 text-xs ${
                  tf === "1M"
                    ? "bg-purple-600 text-white glow-purple"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                {tf}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="h-80 bg-slate-950/50 rounded-lg border border-slate-700/50 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={portfolioData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomPortfolioTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#8b5cf6"
              strokeWidth={3}
              fill="url(#portfolioGradient)"
              dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 5 }}
              activeDot={{ r: 7, stroke: "#8b5cf6", strokeWidth: 3, fill: "#8b5cf6" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Stats */}
      <div className="flex items-center justify-between mt-4 text-sm text-slate-400">
        <div className="flex items-center space-x-6">
          <span>High: ${Math.round(totalValue * 1.05 / 1000)}k</span>
          <span>Low: ${Math.round(totalValue * 0.8 / 1000)}k</span>
          <span>Avg: ${Math.round(totalValue * 0.925 / 1000)}k</span>
        </div>
        <div className="flex items-center space-x-2">
          <span>Last updated: 1m ago</span>
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        </div>
      </div>
    </Card>
  )
}

const CustomPortfolioTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const value = payload[0].value
    const change = payload[0].payload.change
    const changePercent = ((change / (value - change)) * 100).toFixed(2)

    return (
      <div className="bg-slate-800/95 border border-purple-500/30 rounded-lg p-3 shadow-lg backdrop-blur-sm">
        <p className="text-slate-300 text-sm">{`Date: ${label}`}</p>
        <p className="text-purple-400 font-semibold">{`Value: $${value.toLocaleString()}`}</p>
        <p className={`text-sm ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
          {`Change: ${change >= 0 ? "+" : ""}$${change.toLocaleString()} (${changePercent}%)`}
        </p>
      </div>
    )
  }
  return null
}
