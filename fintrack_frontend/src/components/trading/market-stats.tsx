"use client"

import { Card } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Volume2 } from "lucide-react"

const marketData = [
  {
    symbol: "BTC/USDT",
    price: "43,250.00",
    change: "+2.45%",
    changeValue: "+1,032.50",
    isPositive: true,
    volume: "2.4B",
  },
  {
    symbol: "ETH/USDT",
    price: "2,680.50",
    change: "-1.23%",
    changeValue: "-33.20",
    isPositive: false,
    volume: "1.8B",
  },
  {
    symbol: "SOL/USDT",
    price: "98.75",
    change: "+5.67%",
    changeValue: "+5.30",
    isPositive: true,
    volume: "456M",
  },
  {
    symbol: "ADA/USDT",
    price: "0.4521",
    change: "+0.89%",
    changeValue: "+0.004",
    isPositive: true,
    volume: "234M",
  },
]

export function MarketStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {marketData.map((coin) => (
        <Card
          key={coin.symbol}
          className="p-4 bg-slate-900/80 border-purple-500/20 hover:border-purple-500/40 hover:glow-purple transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-heading font-semibold text-white">{coin.symbol}</span>
            {coin.isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-400" />
            )}
          </div>

          <div className="space-y-1">
            <div className="text-2xl font-bold text-white">${coin.price}</div>
            <div className="flex items-center justify-between text-sm">
              <span className={`font-medium ${coin.isPositive ? "text-green-400" : "text-red-400"}`}>
                {coin.change}
              </span>
              <span className="text-slate-400 flex items-center">
                <Volume2 className="h-3 w-3 mr-1" />
                {coin.volume}
              </span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
