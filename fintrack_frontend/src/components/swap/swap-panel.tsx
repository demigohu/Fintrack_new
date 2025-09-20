"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowUpDown, Settings, Zap, AlertCircle, ChevronDown, Search, X } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import Image from "next/image"

interface Token {
  symbol: string
  name: string
  icon: string
  balance: string
  decimals: number
}

const ICP_TOKENS: Token[] = [
  {
    symbol: "ckBTC",
    name: "Chain Key Bitcoin",
    icon: "ckbtc",
    balance: "0.00",
    decimals: 8
  },
  {
    symbol: "ckETH",
    name: "Chain Key Ethereum",
    icon: "cketh",
    balance: "0.00",
    decimals: 18
  }
]

// Helper function to get asset logo
const getAssetLogo = (symbol: string) => {
  const logoMap: Record<string, string> = {
    'ckBTC': '/ckbtc.svg',
    'ckETH': '/cketh.svg',
  }
  return logoMap[symbol] || '/bitcoin.svg' // fallback
}

export function SwapPanel() {
  const { toast } = useToast()
  const [fromToken, setFromToken] = useState<Token>(ICP_TOKENS[0])
  const [toToken, setToToken] = useState<Token>(ICP_TOKENS[1])
  const [fromAmount, setFromAmount] = useState("")
  const [toAmount, setToAmount] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showTokenSelector, setShowTokenSelector] = useState(false)
  const [tokenSelectorType, setTokenSelectorType] = useState<'from' | 'to'>('from')
  const [searchQuery, setSearchQuery] = useState("")
  const [availableTokens, setAvailableTokens] = useState<Token[]>(ICP_TOKENS)

  // Filter tokens based on search query
  const filteredTokens = availableTokens.filter(token =>
    token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Handle token selection
  const handleTokenSelect = (token: Token) => {
    if (tokenSelectorType === 'from') {
      setFromToken(token)
    } else {
      setToToken(token)
    }
    setShowTokenSelector(false)
    setSearchQuery("")
  }

  // Open token selector
  const openTokenSelector = (type: 'from' | 'to') => {
    setTokenSelectorType(type)
    setShowTokenSelector(true)
  }

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
      // TODO: Implement KongSwap logic
      console.log("KongSwap:", { fromToken, toToken, fromAmount, toAmount })
      
      // Show transaction submitted toast
      toast({
        title: "Transaction Submitted",
        description: "KongSwap transaction has been submitted. Please wait for confirmation.",
        variant: "info"
      })
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Show success toast
      toast({
        title: "Swap Successful!",
        description: `Successfully swapped ${fromAmount} ${fromToken.symbol} for ${toAmount} ${toToken.symbol}`,
        variant: "success"
      })
      
      // Reset amounts after successful swap
      setFromAmount("")
      setToAmount("")
    } catch (error) {
      console.error("Swap failed:", error)
      toast({
        title: "Swap Failed",
        description: "An error occurred during the KongSwap. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleMaxClick = () => {
    setFromAmount(fromToken.balance)
  }

  const handlePercentageClick = (percentage: number) => {
    const balance = parseFloat(fromToken.balance)
    const amount = (balance * percentage / 100).toString()
    setFromAmount(amount)
  }

  const getTokenIcon = (token: Token) => {
    return (
      <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center">
        <Image
          src={getAssetLogo(token.symbol)}
          alt={token.symbol}
          width={20}
          height={20}
          className="object-contain"
        />
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Main Swap Interface */}
      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 space-y-4">
        {/* Sell Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            {/* <span className="text-slate-300 text-sm font-medium">Sell</span> */}
            <div className="flex gap-1">
              <button
                onClick={() => handlePercentageClick(50)}
                className="px-2 py-1 text-xs bg-slate-800 text-slate-300 rounded-md hover:bg-slate-700"
              >
                50%
              </button>
              <button
                onClick={() => handlePercentageClick(75)}
                className="px-2 py-1 text-xs bg-slate-800 text-slate-300 rounded-md hover:bg-slate-700"
              >
                75%
              </button>
              <button
                onClick={handleMaxClick}
                className="px-2 py-1 text-xs bg-white text-slate-900 rounded-md hover:bg-slate-100"
              >
                Max
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-4 bg-slate-800 rounded-xl border border-slate-700">
            <div className="flex-1">
              <Input
                type="number"
                placeholder="0"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className="bg-transparent border-none text-white text-2xl placeholder-slate-500 focus:ring-0 p-0 h-auto"
              />
            </div>
            <button
              onClick={() => openTokenSelector('from')}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              {getTokenIcon(fromToken)}
              <span className="text-white font-medium">{fromToken.symbol}</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          
          <div className="text-xs text-slate-400">
            Balance: {parseFloat(fromToken.balance).toFixed(4)} {fromToken.symbol}
          </div>
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSwapTokens}
            className="p-3 bg-slate-800 hover:bg-slate-700 rounded-full border border-slate-700 transition-colors"
          >
            <ArrowUpDown className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Buy Section */}
        <div className="space-y-3">
          {/* <span className="text-slate-300 text-sm font-medium">Buy</span> */}
          
          <div className="flex items-center gap-3 p-4 bg-slate-800 rounded-xl border border-slate-700">
            <div className="flex-1">
              <div className="text-white text-2xl">
                {toAmount || "0"}
              </div>
            </div>
            <button
              onClick={() => openTokenSelector('to')}
              className="flex items-center gap-2 px-3 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors"
            >
              {getTokenIcon(toToken)}
              <span className="text-white font-medium">{toToken.symbol}</span>
              <ChevronDown className="w-4 h-4 text-white" />
            </button>
          </div>
          
          <div className="text-xs text-slate-400">
            Balance: {parseFloat(toToken.balance).toFixed(4)} {toToken.symbol}
          </div>
        </div>

        {/* Swap Button */}
        <Button
          onClick={handleSwap}
          disabled={!fromAmount || !toAmount || isLoading}
          className={`w-full py-4 text-lg font-medium disabled:cursor-not-allowed rounded-xl ${
            fromAmount && toAmount && !isLoading
              ? "bg-purple-600 hover:bg-purple-700 text-white"
              : "bg-slate-800 hover:bg-slate-700 text-white disabled:bg-slate-600"
          }`}
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
      </div>

      {/* Token Selector Modal */}
      {showTokenSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-white text-lg font-semibold">Select a token</h3>
              <button
                onClick={() => setShowTokenSelector(false)}
                className="p-1 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b border-slate-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search tokens"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-700 text-white placeholder-slate-500"
                />
              </div>
            </div>

            {/* Token List */}
            <div className="max-h-96 overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
                  <div className="w-4 h-4 bg-slate-600 rounded flex items-center justify-center">
                    <span className="text-xs">🪙</span>
                  </div>
                  <span>Your tokens</span>
                </div>
                
                <div className="space-y-2">
                  {filteredTokens.map((token) => (
                    <button
                      key={token.symbol}
                      onClick={() => handleTokenSelect(token)}
                      className="w-full flex items-center justify-between p-3 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {getTokenIcon(token)}
                        <div className="text-left">
                          <div className="text-white font-medium">{token.name}</div>
                          <div className="text-slate-400 text-sm">{token.symbol}</div>
                        </div>
                      </div>
                      <div className="text-white text-sm">
                        {parseFloat(token.balance).toFixed(4)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
