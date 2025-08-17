"use client"

import { TradingChart } from "@/components/trading/trading-chart"
import { OrderBook } from "@/components/trading/order-book"
import { TradingPanel } from "@/components/trading/trading-panel"
import { MarketStats } from "@/components/trading/market-stats"
import { RecentTrades } from "@/components/trading/recent-trades"

export default function TradePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-900">
      <div className="p-8 mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-heading font-bold text-white mb-2">Trade</h1>
          <p className="text-slate-400">Trade your crypto assets</p>
        </div>
        {/* Market Stats Header */}
        <MarketStats />

        {/* Main Trading Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-4">
          {/* Chart Section - Takes up most space */}
          <div className="lg:col-span-3 space-y-4">
            <TradingChart />
            <RecentTrades />
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            <TradingPanel />
            <OrderBook />
          </div>
        </div>
      </div>
    </div>
  )
}
