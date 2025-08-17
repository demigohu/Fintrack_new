"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart3, TrendingUp, Maximize2 } from "lucide-react"
import { AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area } from "recharts"

const timeframes = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"]

// Mock trading data
const tradingData = [
  { time: "09:00", price: 41890, volume: 1200 },
  { time: "10:00", price: 42150, volume: 1800 },
  { time: "11:00", price: 41950, volume: 1500 },
  { time: "12:00", price: 42300, volume: 2100 },
  { time: "13:00", price: 42800, volume: 1900 },
  { time: "14:00", price: 42650, volume: 1600 },
  { time: "15:00", price: 43100, volume: 2400 },
  { time: "16:00", price: 43250, volume: 2200 },
  { time: "17:00", price: 43050, volume: 1700 },
  { time: "18:00", price: 43400, volume: 2600 },
  { time: "19:00", price: 43250, volume: 2000 },
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800/95 border border-purple-500/30 rounded-lg p-3 shadow-lg backdrop-blur-sm">
        <p className="text-slate-300 text-sm">{`Time: ${label}`}</p>
        <p className="text-green-400 font-semibold">{`Price: $${payload[0].value.toLocaleString()}`}</p>
        {payload[1] && <p className="text-cyan-400 text-sm">{`Volume: ${payload[1].value}M`}</p>}
      </div>
    )
  }
  return null
}

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

      <div className="h-96 bg-slate-950/50 rounded-lg border border-slate-700/50 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={tradingData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              domain={["dataMin - 200", "dataMax + 200"]}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#priceGradient)"
              dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: "#10b981", strokeWidth: 2, fill: "#10b981" }}
            />
          </AreaChart>
        </ResponsiveContainer>
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
