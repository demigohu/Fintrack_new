"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, Shield, TrendingUp } from "lucide-react"
import { SwapPanel } from "@/components/swap/swap-panel"
import { KongSwapSwapPanel } from "@/components/swap/kongswap-swap-panel"
import { UniswapV3SwapPanel } from "@/components/swap/uniswapv3-swap-panel"

export default function TradePage() {
  const [activeTab, setActiveTab] = useState("kongswap")

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-heading font-bold text-white mb-2">Trade</h1>
          <p className="text-slate-400 text-lg">Swap tokens across different networks</p>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 bg-slate-800/50 border border-slate-700">
              <TabsTrigger 
                value="kongswap" 
                className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  KongSwap
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="uniswapv3-swap"
                className="data-[state=active]:bg-green-600 data-[state=active]:text-white"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Uniswap V3
                </div>
              </TabsTrigger>
            </TabsList>

            {/* KongSwap Tab */}
            <TabsContent value="kongswap" className="space-y-6">
              <div className="flex justify-center">
                <KongSwapSwapPanel />
              </div>
            </TabsContent>


            {/* Uniswap V3 Swap Tab */}
            <TabsContent value="uniswapv3-swap" className="space-y-6">
              <div className="flex justify-center">
                <UniswapV3SwapPanel />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
