"use client"

import { Card } from "@/components/ui/card"
import { PieChart } from "lucide-react"

const allocations = [
  { symbol: "BTC", name: "Bitcoin", percentage: 45.2, value: "$57,635.64", color: "bg-orange-500" },
  { symbol: "ETH", name: "Ethereum", percentage: 28.7, value: "$36,578.24", color: "bg-blue-500" },
  { symbol: "SOL", name: "Solana", percentage: 12.1, value: "$15,421.59", color: "bg-purple-500" },
  { symbol: "ADA", name: "Cardano", percentage: 8.3, value: "$10,584.42", color: "bg-green-500" },
  { symbol: "DOT", name: "Polkadot", percentage: 5.7, value: "$7,230.43", color: "bg-pink-500" },
]

export function AssetAllocation() {
  return (
    <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
      <div className="flex items-center space-x-2 mb-6">
        <PieChart className="h-5 w-5 text-purple-400" />
        <h3 className="font-heading font-semibold text-white text-lg">Asset Allocation</h3>
      </div>

      {/* Pie Chart Visualization */}
      <div className="flex justify-center mb-6">
        <div className="relative w-40 h-40">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {allocations.map((asset, index) => {
              const radius = 40
              const circumference = 2 * Math.PI * radius
              const strokeDasharray = circumference
              const strokeDashoffset = circumference - (asset.percentage / 100) * circumference

              // Calculate rotation for each segment
              const prevPercentages = allocations.slice(0, index).reduce((sum, a) => sum + a.percentage, 0)
              const rotation = (prevPercentages / 100) * 360

              return (
                <circle
                  key={asset.symbol}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="transparent"
                  stroke={asset.color.replace("bg-", "").replace("-500", "")}
                  strokeWidth="8"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-300 hover:stroke-width-10"
                  style={{
                    transformOrigin: "50% 50%",
                    transform: `rotate(${rotation}deg)`,
                    filter: `drop-shadow(0 0 4px ${asset.color.replace("bg-", "").replace("-500", "")})`,
                  }}
                />
              )
            })}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-lg font-bold text-white">$127k</div>
              <div className="text-xs text-slate-400">Total</div>
            </div>
          </div>
        </div>
      </div>

      {/* Asset List */}
      <div className="space-y-3">
        {allocations.map((asset) => (
          <div key={asset.symbol} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${asset.color}`}></div>
              <div>
                <div className="text-white font-semibold text-sm">{asset.symbol}</div>
                <div className="text-slate-400 text-xs">{asset.name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-white font-semibold text-sm">{asset.percentage}%</div>
              <div className="text-slate-400 text-xs">{asset.value}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
