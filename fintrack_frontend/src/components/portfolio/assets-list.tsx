"use client"

import { useEffect, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Coins, TrendingUp, TrendingDown, MoreHorizontal, RefreshCw } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { bitcoinService, ethereumService, currencyService } from "@/services/backend"

type Asset = {
  symbol: string
  name: string
  amount: string
  value: string
  price: string
  change: string
  changeValue: string
  isPositive: boolean
}

export function AssetsList() {
  const { isLoggedIn } = useAuth()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      
      // Mock 24h changes (in real app, these would come from price API)
      const btcChange = 2.45
      const ethChange = -1.23
      
      const newAssets: Asset[] = []
      
      if (btcBalance > 0) {
        newAssets.push({
          symbol: "BTC",
          name: "Bitcoin",
          amount: btcBalance.toFixed(4),
          value: `$${btcValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          price: `$${btcPrice.toLocaleString()}`,
          change: `${btcChange >= 0 ? '+' : ''}${btcChange.toFixed(2)}%`,
          changeValue: `${btcChange >= 0 ? '+' : ''}$${(btcValue * btcChange / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          isPositive: btcChange >= 0,
        })
      }
      
      if (ethBalance > 0) {
        newAssets.push({
          symbol: "ETH",
          name: "Ethereum",
          amount: ethBalance.toFixed(4),
          value: `$${ethValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          price: `$${ethPrice.toLocaleString()}`,
          change: `${ethChange >= 0 ? '+' : ''}${ethChange.toFixed(2)}%`,
          changeValue: `${ethChange >= 0 ? '+' : ''}$${(ethValue * ethChange / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          isPositive: ethChange >= 0,
        })
      }
      
      setAssets(newAssets)
    } catch (e: any) {
      setError(e?.message || "Failed to load assets data")
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
      <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
        <div className="text-slate-400 text-center py-8">
          Memuat assets...
        </div>
      </Card>
    )
  }

  if (assets.length === 0) {
    return (
      <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Coins className="h-5 w-4 text-purple-400" />
            <h3 className="font-heading font-semibold text-white text-lg">Your Assets</h3>
          </div>
          <button
            onClick={() => void loadData()}
            className="p-2 text-slate-400 hover:text-white transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="text-slate-400 text-center py-8">
          Tidak ada assets untuk ditampilkan
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Coins className="h-5 w-5 text-purple-400" />
          <h3 className="font-heading font-semibold text-white text-lg">Your Assets</h3>
        </div>
        <button
          onClick={() => void loadData()}
          className="p-2 text-slate-400 hover:text-white transition-colors"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Table Headers */}
      <div className="grid grid-cols-6 gap-4 text-xs text-slate-400 mb-4 px-2">
        <span>Asset</span>
        <span className="text-right">Holdings</span>
        <span className="text-right">Price</span>
        <span className="text-right">24h Change</span>
        <span className="text-right">Value</span>
        <span></span>
      </div>

      {/* Assets List */}
      <div className="space-y-2">
        {assets.map((asset) => (
          <div
            key={asset.symbol}
            className="grid grid-cols-6 gap-4 items-center py-3 px-2 hover:bg-slate-800/50 rounded-lg transition-colors group"
          >
            {/* Asset Info */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                {asset.symbol.charAt(0)}
              </div>
              <div>
                <div className="text-white font-semibold text-sm">{asset.symbol}</div>
                <div className="text-slate-400 text-xs">{asset.name}</div>
              </div>
            </div>

            {/* Holdings */}
            <div className="text-right">
              <div className="text-white font-mono text-sm">{asset.amount}</div>
              <div className="text-slate-400 text-xs">{asset.symbol}</div>
            </div>

            {/* Price */}
            <div className="text-right">
              <div className="text-white font-mono text-sm">{asset.price}</div>
            </div>

            {/* 24h Change */}
            <div className="text-right">
              <div
                className={`flex items-center justify-end space-x-1 ${asset.isPositive ? "text-green-400" : "text-red-400"}`}
              >
                {asset.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span className="font-semibold text-sm">{asset.change}</span>
              </div>
              <div className={`text-xs ${asset.isPositive ? "text-green-400/70" : "text-red-400/70"}`}>
                {asset.changeValue}
              </div>
            </div>

            {/* Value */}
            <div className="text-right">
              <div className="text-white font-semibold text-sm">{asset.value}</div>
            </div>

            {/* Actions */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-white"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
