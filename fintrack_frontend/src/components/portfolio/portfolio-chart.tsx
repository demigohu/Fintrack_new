"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart3, TrendingUp } from "lucide-react"

const timeframes = ["24H", "7D", "1M", "3M", "1Y", "ALL"]

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

      {/* Chart Area */}
      <div className="relative h-80 bg-slate-950/50 rounded-lg border border-slate-700/50 overflow-hidden">
        {/* Grid Background */}
        <div className="absolute inset-0 bg-cyber-grid opacity-10"></div>

        {/* Mock Portfolio Performance Chart */}
        <div className="absolute inset-0 p-4">
          {/* Y-axis labels */}
          <div className="absolute left-2 top-4 bottom-4 flex flex-col justify-between text-xs text-slate-500">
            <span>$140k</span>
            <span>$120k</span>
            <span>$100k</span>
            <span>$80k</span>
            <span>$60k</span>
          </div>

          {/* Chart line */}
          <div className="ml-12 mr-4 h-full relative">
            <svg className="w-full h-full" viewBox="0 0 400 200">
              <defs>
                <linearGradient id="portfolioGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgb(139, 92, 246)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="rgb(139, 92, 246)" stopOpacity="0.05" />
                </linearGradient>
              </defs>

              {/* Area under curve */}
              <path
                d="M 0 180 Q 50 160 100 140 T 200 120 T 300 100 T 400 80 L 400 200 L 0 200 Z"
                fill="url(#portfolioGradient)"
              />

              {/* Main line */}
              <path
                d="M 0 180 Q 50 160 100 140 T 200 120 T 300 100 T 400 80"
                stroke="rgb(139, 92, 246)"
                strokeWidth="2"
                fill="none"
                className="drop-shadow-lg"
                style={{ filter: "drop-shadow(0 0 4px rgb(139, 92, 246))" }}
              />

              {/* Data points */}
              {[0, 100, 200, 300, 400].map((x, i) => {
                const y = [180, 140, 120, 100, 80][i]
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="4"
                    fill="rgb(139, 92, 246)"
                    className="drop-shadow-lg"
                    style={{ filter: "drop-shadow(0 0 6px rgb(139, 92, 246))" }}
                  />
                )
              })}
            </svg>
          </div>

          {/* X-axis labels */}
          <div className="absolute bottom-2 left-12 right-4 flex justify-between text-xs text-slate-500">
            <span>Jan 1</span>
            <span>Jan 8</span>
            <span>Jan 15</span>
            <span>Jan 22</span>
            <span>Jan 29</span>
          </div>
        </div>

        {/* Current value indicator */}
        <div className="absolute right-4 top-1/4">
          <div className="bg-purple-500 text-white text-xs px-2 py-1 rounded glow-purple">$127,450</div>
        </div>
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
