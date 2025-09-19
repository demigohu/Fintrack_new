"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowUpDown, Settings, Zap, AlertCircle } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"

interface Token {
  symbol: string
  name: string
  icon: string
  balance: string
  decimals: number
}

const ICP_TOKENS: Token[] = [
  {
    symbol: "ICP",
    name: "Internet Computer",
    icon: "ICP",
    balance: "0.00",
    decimals: 8
  },
  {
    symbol: "ckBTC",
    name: "Chain Key Bitcoin",
    icon: "c",
    balance: "0.00",
    decimals: 8
  },
  {
    symbol: "ckETH",
    name: "Chain Key Ethereum",
    icon: "c",
    balance: "0.00",
    decimals: 18
  }
]

export function SwapPanel() {
  const [fromToken, setFromToken] = useState<Token>(ICP_TOKENS[0])
  const [toToken, setToToken] = useState<Token>(ICP_TOKENS[1])
  const [fromAmount, setFromAmount] = useState("")
  const [toAmount, setToAmount] = useState("")
  const [slippage, setSlippage] = useState([0.5])
  const [isLoading, setIsLoading] = useState(false)

  const handleSwapTokens = () => {
    const temp = fromToken
    setFromToken(toToken)
    setToToken(temp)
    setFromAmount(toAmount)
    setToAmount(fromAmount)
  }

  const handleSwap = async () => {
    if (!fromAmount || !toAmount) return
    
    setIsLoading(true)
    try {
      // TODO: Implement ICP swap logic
      console.log("ICP Swap:", { fromToken, toToken, fromAmount, toAmount })
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Reset amounts after successful swap
      setFromAmount("")
      setToAmount("")
    } catch (error) {
      console.error("Swap failed:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getTokenIcon = (token: Token) => {
    if (token.symbol === "ICP") {
      return <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold text-white">ICP</div>
    } else if (token.symbol === "ckBTC") {
      return <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold text-white">c</div>
    } else if (token.symbol === "ckETH") {
      return <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white">c</div>
    }
    return <div className="w-6 h-6 bg-gray-500 rounded-full"></div>
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-400" />
            ICP Swap
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* From Token */}
        <div className="space-y-2">
          <Label className="text-slate-300">From</Label>
          <div className="flex items-center gap-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 flex-1">
              {getTokenIcon(fromToken)}
              <Select value={fromToken.symbol} onValueChange={(value) => {
                const token = ICP_TOKENS.find(t => t.symbol === value)
                if (token) setFromToken(token)
              }}>
                <SelectTrigger className="w-auto bg-transparent border-none text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {ICP_TOKENS.map((token) => (
                    <SelectItem key={token.symbol} value={token.symbol} className="text-white">
                      <div className="flex items-center gap-2">
                        {getTokenIcon(token)}
                        <span>{token.symbol}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col items-end">
              <Input
                type="number"
                placeholder="0.0"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className="bg-transparent border-none text-right text-white text-lg placeholder:text-slate-500"
              />
              <span className="text-xs text-slate-400">Balance: {fromToken.balance}</span>
            </div>
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSwapTokens}
            className="rounded-full p-2 hover:bg-slate-700"
          >
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
          </Button>
        </div>

        {/* To Token */}
        <div className="space-y-2">
          <Label className="text-slate-300">To</Label>
          <div className="flex items-center gap-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 flex-1">
              {getTokenIcon(toToken)}
              <Select value={toToken.symbol} onValueChange={(value) => {
                const token = ICP_TOKENS.find(t => t.symbol === value)
                if (token) setToToken(token)
              }}>
                <SelectTrigger className="w-auto bg-transparent border-none text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {ICP_TOKENS.map((token) => (
                    <SelectItem key={token.symbol} value={token.symbol} className="text-white">
                      <div className="flex items-center gap-2">
                        {getTokenIcon(token)}
                        <span>{token.symbol}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col items-end">
              <Input
                type="number"
                placeholder="0.0"
                value={toAmount}
                onChange={(e) => setToAmount(e.target.value)}
                className="bg-transparent border-none text-right text-white text-lg placeholder:text-slate-500"
              />
              <span className="text-xs text-slate-400">Balance: {toToken.balance}</span>
            </div>
          </div>
        </div>

        {/* Swap Details */}
        <div className="space-y-2 p-3 bg-slate-900/30 rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Rate</span>
            <span className="text-white">1 {fromToken.symbol} = 0.0001 {toToken.symbol}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Price Impact</span>
            <span className="text-green-400">0.01%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Network Fee</span>
            <span className="text-white">~0.001 ICP</span>
          </div>
        </div>

        {/* Slippage Settings */}
        <div className="space-y-2">
          <Label className="text-slate-300">Slippage Tolerance</Label>
          <div className="space-y-2">
            <Slider
              value={slippage}
              onValueChange={setSlippage}
              max={5}
              min={0.1}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>0.1%</span>
              <span className="text-white font-medium">{slippage[0]}%</span>
              <span>5%</span>
            </div>
          </div>
        </div>

        {/* Swap Button */}
        <Button
          onClick={handleSwap}
          disabled={!fromAmount || !toAmount || isLoading}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 text-lg font-medium"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Swapping...
            </div>
          ) : (
            `Swap ${fromToken.symbol} for ${toToken.symbol}`
          )}
        </Button>

        {/* Warning */}
        <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-yellow-200">
            <p className="font-medium">Testnet Warning</p>
            <p>You are trading on Internet Computer testnet. These are test tokens with no real value.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
