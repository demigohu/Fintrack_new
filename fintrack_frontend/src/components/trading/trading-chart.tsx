"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart3, TrendingUp, Maximize2 } from "lucide-react"

const timeframes = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"]

export function TradingChart() {
  return (
    <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
      {/* Chart Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-purple-400" />
            <span className="font-heading font-semibold text-white text-lg">BTC/USDT</span>
          </div>
          <div className="flex items-center space-x-2 text-green-400">
            <TrendingUp className="h-4 w-4" />
            <span className="font-semibold">$43,250.00</span>
            <span className="text-sm">+2.45%</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Timeframe Buttons */}
          <div className="flex bg-slate-800/50 rounded-lg p-1">
            {timeframes.map((tf) => (
              <Button
                key={tf}
                variant="ghost"
                size="sm"
                className={`px-3 py-1 text-xs ${
                  tf === "1h"
                    ? "bg-purple-600 text-white glow-purple"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                {tf}
              </Button>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chart Area - Mock Chart */}
      <div className="relative h-96 bg-slate-950/50 rounded-lg border border-slate-700/50 overflow-hidden">
        {/* Grid Background */}
        <div className="absolute inset-0 bg-cyber-grid opacity-10"></div>

        {/* Mock Candlestick Chart */}
        <div className="absolute inset-0 flex items-end justify-around p-4">
          {Array.from({ length: 50 }, (_, i) => {
            const height = Math.random() * 80 + 20
            const isGreen = Math.random() > 0.5
            return (
              <div
                key={i}
                className={`w-1 rounded-sm ${
                  isGreen ? "bg-green-400 glow-green" : "bg-red-400 glow-red"
                } opacity-80 hover:opacity-100 transition-opacity`}
                style={{ height: `${height}%` }}
              />
            )
          })}
        </div>

        {/* Price Line Overlay */}
        <div className="absolute inset-0 flex items-center">
          <div className="w-full h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60"></div>
        </div>

        {/* Current Price Indicator */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <div className="bg-cyan-500 text-white text-xs px-2 py-1 rounded glow-cyan">$43,250.00</div>
        </div>
      </div>

      {/* Chart Controls */}
      <div className="flex items-center justify-between mt-4 text-sm text-slate-400">
        <div className="flex items-center space-x-4">
          <span>Volume: 2.4B USDT</span>
          <span>24h High: $44,120.00</span>
          <span>24h Low: $41,890.00</span>
        </div>
        <div className="flex items-center space-x-2">
          <span>Last updated: 2s ago</span>
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        </div>
      </div>
    </Card>
  )
}
