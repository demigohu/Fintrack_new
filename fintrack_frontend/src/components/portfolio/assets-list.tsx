"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Coins, TrendingUp, TrendingDown, MoreHorizontal } from "lucide-react"

const assets = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    amount: "1.3456",
    value: "$57,635.64",
    price: "$43,250.00",
    change: "+2.45%",
    changeValue: "+$1,032.50",
    isPositive: true,
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    amount: "13.67",
    value: "$36,578.24",
    price: "$2,675.50",
    change: "-1.23%",
    changeValue: "-$33.20",
    isPositive: false,
  },
  {
    symbol: "SOL",
    name: "Solana",
    amount: "156.23",
    value: "$15,421.59",
    price: "$98.75",
    change: "+5.67%",
    changeValue: "+$5.30",
    isPositive: true,
  },
  {
    symbol: "ADA",
    name: "Cardano",
    amount: "23,412.50",
    value: "$10,584.42",
    price: "$0.4521",
    change: "+0.89%",
    changeValue: "+$0.004",
    isPositive: true,
  },
  {
    symbol: "DOT",
    name: "Polkadot",
    amount: "1,205.67",
    value: "$7,230.43",
    price: "$5.998",
    change: "-3.21%",
    changeValue: "-$0.199",
    isPositive: false,
  },
]

export function AssetsList() {
  return (
    <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Coins className="h-5 w-5 text-purple-400" />
          <h3 className="font-heading font-semibold text-white text-lg">Your Assets</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10 bg-transparent"
        >
          View All
        </Button>
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
