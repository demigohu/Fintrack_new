"use client"

import { TradingChart } from "@/components/trading/trading-chart"
import { OrderBook } from "@/components/trading/order-book"
import { TradingPanel } from "@/components/trading/trading-panel"
import { MarketStats } from "@/components/trading/market-stats"
import { RecentTrades } from "@/components/trading/recent-trades"

export default function TradePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-900">
      <div className="p-4 max-w-[1600px] mx-auto">
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
