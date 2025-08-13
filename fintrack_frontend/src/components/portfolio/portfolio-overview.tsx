"use client"

import { Card } from "@/components/ui/card"
import { TrendingUp, TrendingDown, DollarSign, Percent } from "lucide-react"

const portfolioStats = [
  {
    title: "Total Balance",
    value: "$127,450.32",
    change: "+$8,234.56",
    changePercent: "+6.91%",
    isPositive: true,
    icon: DollarSign,
  },
  {
    title: "24h Change",
    value: "+$2,145.78",
    change: "+1.71%",
    changePercent: "vs yesterday",
    isPositive: true,
    icon: TrendingUp,
  },
  {
    title: "Total P&L",
    value: "+$34,892.15",
    change: "+37.65%",
    changePercent: "all time",
    isPositive: true,
    icon: Percent,
  },
  {
    title: "Available Balance",
    value: "$12,450.00",
    change: "USDT",
    changePercent: "for trading",
    isPositive: null,
    icon: DollarSign,
  },
]

export function PortfolioOverview() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-heading font-bold text-white mb-2">Portfolio Dashboard</h1>
        <p className="text-slate-400">Track your crypto investments and performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {portfolioStats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card
              key={index}
              className="p-6 bg-slate-900/80 border-purple-500/20 hover:border-purple-500/40 hover:glow-purple transition-all group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 glow-purple group-hover:animate-pulse-glow">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                {stat.isPositive !== null && (
                  <div className={`flex items-center ${stat.isPositive ? "text-green-400" : "text-red-400"}`}>
                    {stat.isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-sm text-slate-400">{stat.title}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <div className="flex items-center justify-between text-sm">
                  <span
                    className={
                      stat.isPositive ? "text-green-400" : stat.isPositive === false ? "text-red-400" : "text-slate-400"
                    }
                  >
                    {stat.change}
                  </span>
                  <span className="text-slate-500">{stat.changePercent}</span>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
