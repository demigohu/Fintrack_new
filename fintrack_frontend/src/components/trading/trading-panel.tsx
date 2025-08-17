"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronDown, Plus } from "lucide-react"

export function TradingPanel() {
  const [orderType, setOrderType] = useState("market")
  const [amount, setAmount] = useState("")
  const [selectedToken, setSelectedToken] = useState("ATOM")
  const [paymentMethod, setPaymentMethod] = useState("USDC")

  return (
    <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
      <Tabs defaultValue="buy" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-slate-800/50 p-1">
          <TabsTrigger
            value="buy"
            className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400"
          >
            Buy
          </TabsTrigger>
          <TabsTrigger
            value="sell"
            className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400"
          >
            Sell
          </TabsTrigger>
          <TabsTrigger
            value="swap"
            className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400"
          >
            Swap
          </TabsTrigger>
        </TabsList>

        <TabsContent value="buy" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex bg-slate-800/50 rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                className={`px-4 py-2 text-sm ${
                  orderType === "market" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
                }`}
                onClick={() => setOrderType("market")}
              >
                Market
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`px-4 py-2 text-sm ${
                  orderType === "limit" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
                }`}
                onClick={() => setOrderType("limit")}
              >
                Limit
              </Button>
            </div>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Add funds
            </Button>
          </div>

          <div className="space-y-3">
            <div className="text-sm text-slate-400">Enter an amount to buy</div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-4xl font-light text-white mb-2">$0</div>
                <div className="flex items-center text-sm text-purple-400">
                  <span className="mr-2">↗</span>
                  <span>0 {selectedToken}</span>
                </div>
              </div>
              <div className="flex items-center bg-slate-800/50 rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-700/50">
                <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mr-2"></div>
                <span className="text-white font-medium">{selectedToken}</span>
                <ChevronDown className="h-4 w-4 ml-2 text-slate-400" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">Pay with</span>
            <div className="flex items-center bg-slate-800/50 rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-700/50">
              <div className="w-5 h-5 bg-blue-500 rounded-full mr-2"></div>
              <span className="text-white text-sm">{paymentMethod}</span>
              <ChevronDown className="h-4 w-4 ml-2 text-slate-400" />
            </div>
          </div>

          {orderType === "limit" && (
            <div className="space-y-3">
              <div className="text-sm text-slate-400">When {selectedToken} price is 0% below current price ↗</div>
              <div className="text-2xl font-semibold text-white">$4.639</div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-600 text-slate-400 hover:border-purple-500/50 hover:text-purple-400 bg-slate-800/50"
                >
                  Market
                </Button>
                {["2%", "5%", "10%"].map((percent) => (
                  <Button
                    key={percent}
                    variant="outline"
                    size="sm"
                    className="border-slate-600 text-slate-400 hover:border-purple-500/50 hover:text-purple-400 bg-slate-800/50"
                  >
                    ↓{percent}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 text-lg">
            Buy
          </Button>

          <div className="text-sm text-slate-400 text-center">1 {selectedToken} ≈ $4.639</div>

          <div className="flex items-center justify-between text-slate-400 cursor-pointer hover:text-white transition-colors">
            <div className="flex items-center">
              <div className="w-5 h-5 rounded-full border border-slate-600 mr-3"></div>
              <span className="text-sm">Order history</span>
            </div>
            <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
          </div>
        </TabsContent>

        <TabsContent value="sell" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex bg-slate-800/50 rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                className={`px-4 py-2 text-sm ${
                  orderType === "market" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
                }`}
                onClick={() => setOrderType("market")}
              >
                Market
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`px-4 py-2 text-sm ${
                  orderType === "limit" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
                }`}
                onClick={() => setOrderType("limit")}
              >
                Limit
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm text-slate-400">Enter an amount to sell</div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-4xl font-light text-white mb-2">$0</div>
                <div className="flex items-center text-sm text-red-400">
                  <span className="mr-2">↘</span>
                  <span>0 {selectedToken}</span>
                </div>
              </div>
              <div className="flex items-center bg-slate-800/50 rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-700/50">
                <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mr-2"></div>
                <span className="text-white font-medium">{selectedToken}</span>
                <ChevronDown className="h-4 w-4 ml-2 text-slate-400" />
              </div>
            </div>
          </div>

          <Button className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 text-lg">Sell</Button>

          <div className="text-sm text-slate-400 text-center">1 {selectedToken} ≈ $4.639</div>

          <div className="flex items-center justify-between text-slate-400 cursor-pointer hover:text-white transition-colors">
            <div className="flex items-center">
              <div className="w-5 h-5 rounded-full border border-slate-600 mr-3"></div>
              <span className="text-sm">Order history</span>
            </div>
            <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
          </div>
        </TabsContent>

        <TabsContent value="swap" className="space-y-6">
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 text-xs ml-auto">
            <Plus className="h-3 w-3 mr-1" />
            Add funds
          </Button>

          <div className="space-y-4">
            <div>
              <div className="text-sm text-slate-400 mb-2">From</div>
              <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-4">
                <div className="flex-1">
                  <div className="text-3xl font-light text-slate-500 mb-1">0</div>
                  <div className="text-sm text-slate-500">$0</div>
                </div>
                <div className="flex items-center cursor-pointer hover:bg-slate-700/50 rounded-lg px-2 py-1">
                  <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mr-2"></div>
                  <span className="text-white font-medium">ATOM</span>
                  <ChevronDown className="h-4 w-4 ml-2 text-slate-400" />
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center">
                <span className="text-slate-400">↕</span>
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-400 mb-2">To</div>
              <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-4">
                <div className="flex-1">
                  <div className="text-3xl font-light text-slate-500 mb-1">0</div>
                  <div className="text-sm text-slate-500">$0</div>
                </div>
                <div className="flex items-center cursor-pointer hover:bg-slate-700/50 rounded-lg px-2 py-1">
                  <div className="w-6 h-6 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full mr-2"></div>
                  <span className="text-white font-medium">OSMO</span>
                  <ChevronDown className="h-4 w-4 ml-2 text-slate-400" />
                </div>
              </div>
            </div>
          </div>

          <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 text-lg">
            Swap
          </Button>

          <div className="text-sm text-slate-400 text-center">1 ATOM ≈ 25.915 OSMO ($4.639)</div>

          <div className="flex items-center justify-between text-slate-400 cursor-pointer hover:text-white transition-colors">
            <div className="flex items-center">
              <div className="w-5 h-5 rounded-full border border-slate-600 mr-3"></div>
              <span className="text-sm">Order history</span>
            </div>
            <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  )
}
