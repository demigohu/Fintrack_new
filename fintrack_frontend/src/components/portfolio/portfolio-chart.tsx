"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart3, TrendingUp } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const timeframes = ["24H", "7D", "1M", "3M", "1Y", "ALL"]

// Mock portfolio performance data
const portfolioData = [
  { date: "Jan 1", value: 65000, change: 0 },
  { date: "Jan 5", value: 72000, change: 7000 },
  { date: "Jan 10", value: 68000, change: 3000 },
  { date: "Jan 15", value: 85000, change: 20000 },
  { date: "Jan 20", value: 92000, change: 27000 },
  { date: "Jan 25", value: 105000, change: 40000 },
  { date: "Jan 30", value: 127450, change: 62450 },
]

const CustomPortfolioTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const value = payload[0].value
    const change = payload[0].payload.change
    const changePercent = ((change / (value - change)) * 100).toFixed(2)

    return (
      <div className="bg-slate-800/95 border border-purple-500/30 rounded-lg p-3 shadow-lg backdrop-blur-sm">
        <p className="text-slate-300 text-sm">{`Date: ${label}`}</p>
        <p className="text-purple-400 font-semibold">{`Value: $${value.toLocaleString()}`}</p>
        <p className={`text-sm ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
          {`Change: ${change >= 0 ? "+" : ""}$${change.toLocaleString()} (${changePercent}%)`}
        </p>
      </div>
    )
  }
  return null
}

export function PortfolioChart() {
  return (
    <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
      {/* Chart Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-purple-400" />
            <span className="font-heading font-semibold text-white text-lg">Portfolio Performance</span>
          </div>
          <div className="flex items-center space-x-2 text-green-400">
            <TrendingUp className="h-4 w-4" />
            <span className="font-semibold">+37.65%</span>
            <span className="text-sm">All Time</span>
          </div>
        </div>

        <div className="flex bg-slate-800/50 rounded-lg p-1">
          {timeframes.map((tf) => (
            <Button
              key={tf}
              variant="ghost"
              size="sm"
              className={`px-3 py-1 text-xs ${
                tf === "1M"
                  ? "bg-purple-600 text-white glow-purple"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              {tf}
            </Button>
          ))}
        </div>
      </div>

      <div className="h-80 bg-slate-950/50 rounded-lg border border-slate-700/50 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={portfolioData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomPortfolioTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#8b5cf6"
              strokeWidth={3}
              fill="url(#portfolioGradient)"
              dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 5 }}
              activeDot={{ r: 7, stroke: "#8b5cf6", strokeWidth: 3, fill: "#8b5cf6" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Stats */}
      <div className="flex items-center justify-between mt-4 text-sm text-slate-400">
        <div className="flex items-center space-x-6">
          <span>High: $129,340.50</span>
          <span>Low: $92,150.00</span>
          <span>Avg: $108,245.25</span>
        </div>
        <div className="flex items-center space-x-2">
          <span>Last updated: 1m ago</span>
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        </div>
      </div>
    </Card>
  )
}
