"use client"

import { PortfolioOverview } from "@/components/portfolio/portfolio-overview"
import { AssetAllocation } from "@/components/portfolio/asset-allocation"
import { PortfolioChart } from "@/components/portfolio/portfolio-chart"
import { AssetsList } from "@/components/portfolio/assets-list"
import { TransactionHistory } from "@/components/portfolio/transaction-history"

export default function PortfolioPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-900">
      {/* <Navigation /> */}

      <div className="p-4 max-w-[1600px] mx-auto">
        {/* Portfolio Overview */}
        <PortfolioOverview />

        {/* Main Dashboard Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Left Column - Charts */}
          <div className="lg:col-span-2 space-y-6">
            <PortfolioChart />
            <AssetsList />
          </div>

          {/* Right Column - Allocation & Transactions */}
          <div className="space-y-6">
            <AssetAllocation />
            <TransactionHistory />
          </div>
        </div>
      </div>
    </div>
  )
}
