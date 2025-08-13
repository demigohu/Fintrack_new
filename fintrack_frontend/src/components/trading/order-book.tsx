"use client"

import { Card } from "@/components/ui/card"
import { BookOpen } from "lucide-react"

// Mock order book data
const sellOrders = [
  { price: "43,280.50", amount: "0.125", total: "5,410.06" },
  { price: "43,275.00", amount: "0.089", total: "3,851.48" },
  { price: "43,270.25", amount: "0.234", total: "10,125.24" },
  { price: "43,265.80", amount: "0.156", total: "6,749.46" },
  { price: "43,260.00", amount: "0.078", total: "3,374.28" },
]

const buyOrders = [
  { price: "43,245.00", amount: "0.167", total: "7,221.92" },
  { price: "43,240.50", amount: "0.234", total: "10,118.28" },
  { price: "43,235.75", amount: "0.089", total: "3,847.98" },
  { price: "43,230.00", amount: "0.145", total: "6,268.35" },
  { price: "43,225.25", amount: "0.198", total: "8,558.60" },
]

export function OrderBook() {
  return (
    <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
      <div className="flex items-center space-x-2 mb-6">
        <BookOpen className="h-5 w-5 text-purple-400" />
        <h3 className="font-heading font-semibold text-white text-lg">Order Book</h3>
      </div>

      {/* Headers */}
      <div className="grid grid-cols-3 gap-2 text-xs text-slate-400 mb-3 px-2">
        <span>Price (USDT)</span>
        <span className="text-right">Amount (BTC)</span>
        <span className="text-right">Total</span>
      </div>

      {/* Sell Orders */}
      <div className="space-y-1 mb-4">
        {sellOrders.reverse().map((order, index) => (
          <div
            key={index}
            className="grid grid-cols-3 gap-2 text-xs py-1 px-2 hover:bg-red-500/10 rounded cursor-pointer transition-colors relative"
          >
            <div className="absolute inset-0 bg-red-500/5 rounded" style={{ width: `${Math.random() * 60 + 20}%` }} />
            <span className="text-red-400 font-mono relative z-10">{order.price}</span>
            <span className="text-slate-300 text-right font-mono relative z-10">{order.amount}</span>
            <span className="text-slate-400 text-right font-mono relative z-10">{order.total}</span>
          </div>
        ))}
      </div>

      {/* Current Price */}
      <div className="flex items-center justify-center py-3 mb-4 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent rounded">
        <span className="text-cyan-400 font-bold text-lg font-mono glow-cyan">43,250.00</span>
        <span className="text-green-400 text-sm ml-2">↗ +2.45%</span>
      </div>

      {/* Buy Orders */}
      <div className="space-y-1">
        {buyOrders.map((order, index) => (
          <div
            key={index}
            className="grid grid-cols-3 gap-2 text-xs py-1 px-2 hover:bg-green-500/10 rounded cursor-pointer transition-colors relative"
          >
            <div className="absolute inset-0 bg-green-500/5 rounded" style={{ width: `${Math.random() * 60 + 20}%` }} />
            <span className="text-green-400 font-mono relative z-10">{order.price}</span>
            <span className="text-slate-300 text-right font-mono relative z-10">{order.amount}</span>
            <span className="text-slate-400 text-right font-mono relative z-10">{order.total}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
