"use client"

import { useEffect, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { useAuth } from "@/contexts/AuthContext"
import { bitcoinService, ethereumService } from "@/services/backend"
import { RefreshCw } from "lucide-react"

type AssetAllocation = {
  symbol: string
  name: string
  percentage: number
  value: number
  color: string
}

export function AssetAllocation() {
  const { isLoggedIn } = useAuth()
  const [allocations, setAllocations] = useState<AssetAllocation[]>([])
  const [totalValue, setTotalValue] = useState(0)
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
      
      const btcBalance = Number(btcRes.data) / 100000000 // Convert satoshis to BTC
      const ethBalance = Number(ethRes.data) / 1000000000000000000 // Convert wei to ETH
      
      // Mock prices (in real app, these would come from price API)
      const btcPrice = 43250
      const ethPrice = 2675
      
      const btcValue = btcBalance * btcPrice
      const ethValue = ethBalance * ethPrice
      const currentTotalValue = btcValue + ethValue
      
      setTotalValue(currentTotalValue)
      
      if (currentTotalValue > 0) {
        const newAllocations: AssetAllocation[] = [
          {
            symbol: "BTC",
            name: "Bitcoin",
            percentage: (btcValue / currentTotalValue) * 100,
            value: btcValue,
            color: "#f97316"
          },
          {
            symbol: "ETH",
            name: "Ethereum",
            percentage: (ethValue / currentTotalValue) * 100,
            value: ethValue,
            color: "#3b82f6"
          }
        ]
        
        // Only show assets with balance > 0
        const filteredAllocations = newAllocations.filter(asset => asset.value > 0)
        setAllocations(filteredAllocations)
      } else {
        setAllocations([])
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load allocation data")
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
          Memuat allocation...
        </div>
      </Card>
    )
  }

  if (allocations.length === 0) {
    return (
      <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <div className="h-5 w-5 text-purple-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                <path d="M22 12A10 10 0 0 0 12 2v10z" />
              </svg>
            </div>
            <h3 className="font-heading font-semibold text-white text-lg">Asset Allocation</h3>
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
          Tidak ada asset untuk ditampilkan
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <div className="h-5 w-5 text-purple-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
              <path d="M22 12A10 10 0 0 0 12 2v10z" />
            </svg>
          </div>
          <h3 className="font-heading font-semibold text-white text-lg">Asset Allocation</h3>
        </div>
        <button
          onClick={() => void loadData()}
          className="p-2 text-slate-400 hover:text-white transition-colors"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="h-80 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={allocations}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={100}
              innerRadius={40}
              fill="#8884d8"
              dataKey="percentage"
              animationBegin={0}
              animationDuration={1000}
            >
              {allocations.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke={entry.color}
                  strokeWidth={2}
                  style={{
                    filter: `drop-shadow(0 0 8px ${entry.color}40)`,
                    cursor: "pointer",
                  }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            {/* Center total value display */}
            <text
              x="50%"
              y="45%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-lg font-bold fill-white"
            >
              ${Math.round(totalValue / 1000)}k
            </text>
            <text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle" className="text-xs fill-slate-400">
              Total
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Asset List */}
      <div className="space-y-3">
        {allocations.map((asset) => (
          <div
            key={asset.symbol}
            className="flex items-center justify-between hover:bg-slate-800/50 rounded-lg p-2 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: asset.color,
                  boxShadow: `0 0 8px ${asset.color}40`,
                }}
              ></div>
              <div>
                <div className="text-white font-semibold text-sm">{asset.symbol}</div>
                <div className="text-slate-400 text-xs">{asset.name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-white font-semibold text-sm">{asset.percentage.toFixed(1)}%</div>
              <div className="text-slate-400 text-xs">${asset.value.toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-slate-800/95 border border-purple-500/30 rounded-lg p-3 shadow-lg backdrop-blur-sm">
        <div className="text-white font-semibold">{data.name}</div>
        <div className="text-purple-400 text-sm">{data.symbol}</div>
        <div className="text-cyan-400 font-bold">{data.percentage.toFixed(1)}%</div>
        <div className="text-slate-300 text-sm">${data.value.toLocaleString()}</div>
      </div>
    )
  }
  return null
}

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return percent > 0.05 ? (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      className="text-xs font-semibold"
      style={{ filter: "drop-shadow(0 0 2px rgba(0,0,0,0.8))" }}
    >
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  ) : null
}
