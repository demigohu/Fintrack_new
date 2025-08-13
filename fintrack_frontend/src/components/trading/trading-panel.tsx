"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react"

export function TradingPanel() {
  const [orderType, setOrderType] = useState("market")
  const [amount, setAmount] = useState("")
  const [price, setPrice] = useState("")

  return (
    <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-heading font-semibold text-white text-lg">Trade BTC/USDT</h3>
        <div className="flex items-center text-sm text-slate-400">
          <Wallet className="h-4 w-4 mr-1" />
          Balance: 1,250.00 USDT
        </div>
      </div>

      <Tabs defaultValue="buy" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 bg-slate-800/50">
          <TabsTrigger
            value="buy"
            className="data-[state=active]:bg-green-600 data-[state=active]:text-white data-[state=active]:glow-green"
          >
            <ArrowUpRight className="h-4 w-4 mr-1" />
            Buy
          </TabsTrigger>
          <TabsTrigger
            value="sell"
            className="data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=active]:glow-red"
          >
            <ArrowDownRight className="h-4 w-4 mr-1" />
            Sell
          </TabsTrigger>
        </TabsList>

        <TabsContent value="buy" className="space-y-4">
          {/* Order Type */}
          <div className="flex bg-slate-800/50 rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              className={`flex-1 text-xs ${
                orderType === "market" ? "bg-purple-600 text-white glow-purple" : "text-slate-400 hover:text-white"
              }`}
              onClick={() => setOrderType("market")}
            >
              Market
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`flex-1 text-xs ${
                orderType === "limit" ? "bg-purple-600 text-white glow-purple" : "text-slate-400 hover:text-white"
              }`}
              onClick={() => setOrderType("limit")}
            >
              Limit
            </Button>
          </div>

          {/* Price Input (for limit orders) */}
          {orderType === "limit" && (
            <div className="space-y-2">
              <Label className="text-slate-300">Price (USDT)</Label>
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="43,250.00"
                className="bg-slate-800/50 border-slate-600 focus:border-green-500 focus:ring-green-500/20 text-white"
              />
            </div>
          )}

          {/* Amount Input */}
          <div className="space-y-2">
            <Label className="text-slate-300">Amount (BTC)</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.001"
              className="bg-slate-800/50 border-slate-600 focus:border-green-500 focus:ring-green-500/20 text-white"
            />
          </div>

          {/* Percentage Buttons */}
          <div className="grid grid-cols-4 gap-2">
            {["25%", "50%", "75%", "100%"].map((percent) => (
              <Button
                key={percent}
                variant="outline"
                size="sm"
                className="border-slate-600 text-slate-400 hover:border-green-500/50 hover:text-green-400 hover:bg-green-500/10 bg-transparent"
              >
                {percent}
              </Button>
            ))}
          </div>

          {/* Total */}
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Total:</span>
            <span className="text-white font-semibold">~54.06 USDT</span>
          </div>

          {/* Buy Button */}
          <Button className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 glow-green text-white font-semibold">
            Buy BTC
          </Button>
        </TabsContent>

        <TabsContent value="sell" className="space-y-4">
          {/* Order Type */}
          <div className="flex bg-slate-800/50 rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              className={`flex-1 text-xs ${
                orderType === "market" ? "bg-purple-600 text-white glow-purple" : "text-slate-400 hover:text-white"
              }`}
              onClick={() => setOrderType("market")}
            >
              Market
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`flex-1 text-xs ${
                orderType === "limit" ? "bg-purple-600 text-white glow-purple" : "text-slate-400 hover:text-white"
              }`}
              onClick={() => setOrderType("limit")}
            >
              Limit
            </Button>
          </div>

          {/* Price Input (for limit orders) */}
          {orderType === "limit" && (
            <div className="space-y-2">
              <Label className="text-slate-300">Price (USDT)</Label>
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="43,250.00"
                className="bg-slate-800/50 border-slate-600 focus:border-red-500 focus:ring-red-500/20 text-white"
              />
            </div>
          )}

          {/* Amount Input */}
          <div className="space-y-2">
            <Label className="text-slate-300">Amount (BTC)</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.001"
              className="bg-slate-800/50 border-slate-600 focus:border-red-500 focus:ring-red-500/20 text-white"
            />
          </div>

          {/* Percentage Buttons */}
          <div className="grid grid-cols-4 gap-2">
            {["25%", "50%", "75%", "100%"].map((percent) => (
              <Button
                key={percent}
                variant="outline"
                size="sm"
                className="border-slate-600 text-slate-400 hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10 bg-transparent"
              >
                {percent}
              </Button>
            ))}
          </div>

          {/* Total */}
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Total:</span>
            <span className="text-white font-semibold">~54.06 USDT</span>
          </div>

          {/* Sell Button */}
          <Button className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 glow-red text-white font-semibold">
            Sell BTC
          </Button>
        </TabsContent>
      </Tabs>
    </Card>
  )
}
