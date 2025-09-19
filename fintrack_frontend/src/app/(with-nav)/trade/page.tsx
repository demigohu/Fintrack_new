"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, Shield, TrendingUp } from "lucide-react"
import { SwapPanel } from "@/components/swap/swap-panel"
import { UniswapSwapPanel } from "@/components/swap/uniswap-swap-panel"
import { UniswapV3SwapPanel } from "@/components/swap/uniswapv3-swap-panel"

export default function TradePage() {
  const [activeTab, setActiveTab] = useState("icp-swap")

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
            <TabsList className="grid w-full grid-cols-3 mb-8 bg-slate-800/50 border border-slate-700">
              <TabsTrigger 
                value="icp-swap" 
                className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  ICP Swap
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="uniswap-swap"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Uniswap V4
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

            {/* ICP Swap Tab */}
            <TabsContent value="icp-swap" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Swap Panel */}
                <div className="lg:col-span-2">
                  <SwapPanel />
                </div>

                {/* Info Panel */}
                <div className="space-y-4">
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Shield className="w-5 h-5 text-green-400" />
                        ICP Network
                      </CardTitle>
                      <CardDescription>
                        Fast and secure swaps on Internet Computer
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Network</span>
                          <span className="text-white">Internet Computer</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Fee</span>
                          <span className="text-green-400">~0.001 ICP</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Speed</span>
                          <span className="text-green-400">~2 seconds</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white">Supported Assets</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold text-white">ICP</div>
                          <span className="text-white">ICP</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold text-white">c</div>
                          <span className="text-white">ckBTC</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white">c</div>
                          <span className="text-white">ckETH</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Uniswap V4 Swap Tab */}
            <TabsContent value="uniswap-swap" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Swap Panel */}
                <div className="lg:col-span-2">
                  <UniswapSwapPanel />
                </div>

                {/* Info Panel */}
                <div className="space-y-4">
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-400" />
                        Ethereum Network
                      </CardTitle>
                      <CardDescription>
                        Decentralized swaps on Uniswap v4
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Network</span>
                          <span className="text-white">Ethereum Sepolia</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Fee</span>
                          <span className="text-blue-400">~0.05%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Speed</span>
                          <span className="text-blue-400">~15 seconds</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white">Supported Assets</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white">Ξ</div>
                          <span className="text-white">ETH</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold text-white">$</div>
                          <span className="text-white">USDC</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center text-xs font-bold text-white">W</div>
                          <span className="text-white">WETH</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white">Features</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-slate-300">Best price routing</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-slate-300">MEV protection</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-slate-300">Slippage protection</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Uniswap V3 Swap Tab */}
            <TabsContent value="uniswapv3-swap" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Swap Panel */}
                <div className="lg:col-span-2">
                  <UniswapV3SwapPanel />
          </div>

                {/* Info Panel */}
          <div className="space-y-4">
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-400" />
                        Ethereum Network
                      </CardTitle>
                      <CardDescription>
                        Decentralized swaps on Uniswap v3
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Network</span>
                          <span className="text-white">Ethereum Sepolia</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Fee Tiers</span>
                          <span className="text-green-400">0.05%, 0.3%, 1%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Speed</span>
                          <span className="text-green-400">~15 seconds</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white">Supported Assets</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white">Ξ</div>
                          <span className="text-white">ETH</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold text-white">$</div>
                          <span className="text-white">USDC</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center text-xs font-bold text-white">W</div>
                          <span className="text-white">WETH</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold text-white">T</div>
                          <span className="text-white">USDT</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white">V3 Features</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-slate-300">Concentrated liquidity</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-slate-300">Multiple fee tiers</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-slate-300">Capital efficiency</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-slate-300">Flexible pricing</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
          </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
