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

      <div className="p-8 mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-heading font-bold text-white mb-2">Portfolio Dashboard</h1>
          <p className="text-slate-400">Track your crypto investments and performance</p>
        </div>
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
