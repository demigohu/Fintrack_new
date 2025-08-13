"use client"

import { Card } from "@/components/ui/card"
import { Clock } from "lucide-react"

// Mock recent trades data
const recentTrades = [
  { price: "43,250.00", amount: "0.125", time: "14:32:15", type: "buy" },
  { price: "43,248.50", amount: "0.089", time: "14:32:12", type: "sell" },
  { price: "43,252.25", amount: "0.234", time: "14:32:08", type: "buy" },
  { price: "43,247.80", amount: "0.156", time: "14:32:05", type: "sell" },
  { price: "43,251.00", amount: "0.078", time: "14:32:02", type: "buy" },
  { price: "43,249.50", amount: "0.167", time: "14:31:58", type: "buy" },
  { price: "43,246.75", amount: "0.234", time: "14:31:55", type: "sell" },
  { price: "43,253.00", amount: "0.089", time: "14:31:52", type: "buy" },
]

export function RecentTrades() {
  return (
    <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
      <div className="flex items-center space-x-2 mb-6">
        <Clock className="h-5 w-5 text-purple-400" />
        <h3 className="font-heading font-semibold text-white text-lg">Recent Trades</h3>
      </div>

      {/* Headers */}
      <div className="grid grid-cols-3 gap-4 text-xs text-slate-400 mb-3 px-2">
        <span>Price (USDT)</span>
        <span className="text-right">Amount (BTC)</span>
        <span className="text-right">Time</span>
      </div>

      {/* Trades List */}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {recentTrades.map((trade, index) => (
          <div
            key={index}
            className="grid grid-cols-3 gap-4 text-xs py-2 px-2 hover:bg-slate-800/50 rounded cursor-pointer transition-colors"
          >
            <span className={`font-mono font-semibold ${trade.type === "buy" ? "text-green-400" : "text-red-400"}`}>
              {trade.price}
            </span>
            <span className="text-slate-300 text-right font-mono">{trade.amount}</span>
            <span className="text-slate-400 text-right font-mono">{trade.time}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
