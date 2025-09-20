"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowUpDown, Settings, Zap, AlertCircle, ChevronDown, Search, X, Loader2, CheckCircle, Clock } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import Image from "next/image"
import { kongswapService, authService } from "@/services/backend"
import { Principal } from "@dfinity/principal"
import { transferICRC1Token, getICRC1Balance, KONGSWAP_CANISTER } from "@/utils/icrc1"

interface Token {
  symbol: string
  name: string
  icon: string
  balance: string
  decimals: number
}

const KONGSWAP_TOKENS: Token[] = [
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

// KongSwap Canister Address
const KONGSWAP_CANISTER_ADDRESS = KONGSWAP_CANISTER

// Helper function to get asset logo
const getAssetLogo = (symbol: string) => {
  const logoMap: Record<string, string> = {
    'ckBTC': '/ckbtc.svg',
    'ckETH': '/cketh.svg',
  }
  return logoMap[symbol] || '/bitcoin.svg' // fallback
}

// Helper function to format token amounts
const formatTokenAmount = (amount: string, decimals: number): string => {
  const num = parseFloat(amount)
  if (isNaN(num)) return "0.00"
  return (num / Math.pow(10, decimals)).toFixed(8)
}

// Helper function to parse token amounts
const parseTokenAmount = (amount: string, decimals: number): string => {
  const num = parseFloat(amount)
  if (isNaN(num)) return "0"
  return Math.floor(num * Math.pow(10, decimals)).toString()
}

interface SwapPreview {
  from_token: string
  to_token: string
  from_amount: string
  to_amount: string
  price: number
  mid_price: number
  slippage: number
  lp_fee: string
  gas_fee: string
}

interface SwapStatus {
  success: boolean
  tx_id?: number
  request_id?: number
  status?: string
  from_amount?: string
  to_amount?: string
  price?: number
  slippage?: number
  error?: string
}

export function KongSwapSwapPanel() {
  const { toast } = useToast()
  const [fromToken, setFromToken] = useState<Token>(KONGSWAP_TOKENS[0])
  const [toToken, setToToken] = useState<Token>(KONGSWAP_TOKENS[1])
  const [fromAmount, setFromAmount] = useState("")
  const [toAmount, setToAmount] = useState("")
  const [slippage, setSlippage] = useState(0.5)
  const [showTokenSelector, setShowTokenSelector] = useState<'from' | 'to' | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [preview, setPreview] = useState<SwapPreview | null>(null)
  const [swapStatus, setSwapStatus] = useState<SwapStatus | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [requestId, setRequestId] = useState<number | null>(null)
  const [userPrincipal, setUserPrincipal] = useState<Principal | null>(null)

  // Load user principal and balances on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        // Check if user is authenticated
        const isAuthenticated = await authService.isAuthenticated()
        if (!isAuthenticated) {
          console.log("User not authenticated, using anonymous principal")
          setUserPrincipal(Principal.anonymous())
          return
        }

        // Get authenticated user principal
        const principalText = await authService.getCurrentUser()
        if (!principalText) {
          console.log("No user principal found, using anonymous")
          setUserPrincipal(Principal.anonymous())
          return
        }

        const principal = Principal.fromText(principalText)
        setUserPrincipal(principal)

        // Load token balances with authenticated identity
        const [ckbtcBalance, ckethBalance] = await Promise.all([
          getICRC1Balance('ckBTC', { owner: principal, subaccount: null }, undefined),
          getICRC1Balance('ckETH', { owner: principal, subaccount: null }, undefined)
        ])

        // Update token balances
        setFromToken(prev => ({
          ...prev,
          balance: formatTokenAmount(ckbtcBalance.toString(), 8)
        }))
        setToToken(prev => ({
          ...prev,
          balance: formatTokenAmount(ckethBalance.toString(), 18)
        }))
        console.log("ckbtcBalance", ckbtcBalance)
        console.log("ckethBalance", ckethBalance)
      } catch (error) {
        console.error("Failed to load user data:", error)
      }
    }

    loadUserData()
  }, [])

  // Get preview when amount changes
  useEffect(() => {
    const getPreview = async () => {
      if (!fromAmount || parseFloat(fromAmount) <= 0) {
        setPreview(null)
        setToAmount("")
        return
      }

      try {
        const amount = parseTokenAmount(fromAmount, fromToken.decimals)
        const result = await kongswapService.previewSwap({
          from_token: fromToken.symbol,
          to_token: toToken.symbol,
          amount: Number(amount), // Convert string to number for nat type
          max_slippage: slippage,
          referred_by: null
        })

        if (result.success) {
          setPreview(result.data)
          setToAmount(formatTokenAmount(result.data.to_amount, toToken.decimals))
        } else {
          setPreview(null)
          setToAmount("")
          console.error("Preview failed:", result.error)
        }
      } catch (error) {
        console.error("Preview error:", error)
        setPreview(null)
        setToAmount("")
      }
    }

    const timeoutId = setTimeout(getPreview, 500) // Debounce
    return () => clearTimeout(timeoutId)
  }, [fromAmount, fromToken, toToken, slippage])

  // Poll swap status
  useEffect(() => {
    if (!requestId || !isPolling) return

    const pollStatus = async () => {
      try {
        const result = await kongswapService.pollSwapStatus(requestId)
        if (result.success) {
          setSwapStatus(result.data)
          
          if (result.data.success || result.data.status === 'failed') {
            setIsPolling(false)
            if (result.data.success) {
              toast({
                title: "Swap Completed!",
                description: `Successfully swapped ${fromAmount} ${fromToken.symbol} for ${toAmount} ${toToken.symbol}`,
              })
            } else {
              toast({
                title: "Swap Failed",
                description: result.data.error || "Unknown error occurred",
                variant: "destructive"
              })
            }
          }
        }
      } catch (error) {
        console.error("Polling error:", error)
        setIsPolling(false)
      }
    }

    const interval = setInterval(pollStatus, 2000) // Poll every 2 seconds
    return () => clearInterval(interval)
  }, [requestId, isPolling, fromAmount, fromToken.symbol, toAmount, toToken.symbol, toast])

  const handleSwap = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount to swap",
        variant: "destructive"
      })
      return
    }

    if (!preview) {
      toast({
        title: "Preview Required",
        description: "Please wait for the swap preview to load",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    setSwapStatus(null)

    try {
      // Step 1: Transfer token to KongSwap using ICRC1
      const amount = parseTokenAmount(fromAmount, fromToken.decimals)
      
      toast({
        title: "Transferring Token",
        description: `Transferring ${fromAmount} ${fromToken.symbol} to KongSwap...`,
      })

      // Use the loaded user principal
      if (!userPrincipal) {
        throw new Error("User principal not loaded")
      }
      
      // Transfer token to KongSwap with authenticated identity
      const transferResult = await transferICRC1Token(
        fromToken.symbol as 'ckBTC' | 'ckETH',
        {
          to: {
            owner: Principal.fromText(KONGSWAP_CANISTER_ADDRESS),
            subaccount: null
          },
          amount: BigInt(amount),
          fee: null,
          memo: null,
          created_at_time: null,
          from_subaccount: null
        },
        undefined // Use authenticated identity from authService
      )

      if (transferResult.Err) {
        throw new Error(`Transfer failed: ${JSON.stringify(transferResult.Err)}`)
      }

      const blockIndex = transferResult.Ok
      if (!blockIndex) {
        throw new Error("No block index returned from transfer")
      }

      toast({
        title: "Transfer Successful",
        description: `Token transferred. Block index: ${blockIndex}`,
      })

        // Step 2: Call KongSwap with the block index
        const swapResult = await kongswapService.swapTokensAsync({
          from_token: fromToken.symbol,
          to_token: toToken.symbol,
          amount: Number(amount), // Convert string to number for nat type
          pay_tx_id: {
            BlockIndex: Number(blockIndex),
            TransactionId: null
          },
          max_slippage: slippage,
          referred_by: null
        })

      if (swapResult.success) {
        setRequestId(swapResult.data)
        setIsPolling(true)
        
        toast({
          title: "Swap Initiated",
          description: `Swap request submitted. Request ID: ${swapResult.data}`,
        })
      } else {
        throw new Error(swapResult.error)
      }

    } catch (error: any) {
      console.error("Swap error:", error)
      toast({
        title: "Swap Failed",
        description: error.message || "Failed to execute swap",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const switchTokens = () => {
    setFromToken(toToken)
    setToToken(fromToken)
    setFromAmount(toAmount)
    setToAmount(fromAmount)
    setPreview(null)
  }

  const handleMaxClick = () => {
    setFromAmount(fromToken.balance)
  }

  const handlePercentageClick = (percentage: number) => {
    const balance = parseFloat(fromToken.balance)
    const amount = (balance * percentage / 100).toString()
    setFromAmount(amount)
  }

  const getTokenIcon = (token: Token) => (
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

  const getStatusIcon = () => {
    if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />
    if (swapStatus?.success) return <CheckCircle className="h-4 w-4 text-green-500" />
    if (swapStatus?.status === 'pending') return <Clock className="h-4 w-4 text-yellow-500" />
    if (swapStatus?.status === 'failed') return <AlertCircle className="h-4 w-4 text-red-500" />
    return null
  }

  const getStatusText = () => {
    if (isLoading) return "Processing..."
    if (swapStatus?.success) return "Completed"
    if (swapStatus?.status === 'pending') return "Pending"
    if (swapStatus?.status === 'failed') return "Failed"
    return ""
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Main Swap Interface */}
      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 space-y-4">
        {/* Header with Status */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white text-lg font-semibold">KongSwap</h3>
            <p className="text-slate-400 text-sm">Multi-hop ckBTC ↔ ckETH</p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="text-sm text-slate-400">{getStatusText()}</span>
          </div>
        </div>

        {/* Sell Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
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
              onClick={() => setShowTokenSelector('from')}
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
            onClick={switchTokens}
            className="p-3 bg-slate-800 hover:bg-slate-700 rounded-full border border-slate-700 transition-colors"
          >
            <ArrowUpDown className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Buy Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-4 bg-slate-800 rounded-xl border border-slate-700">
            <div className="flex-1">
              <div className="text-white text-2xl">
                {toAmount || "0"}
              </div>
            </div>
            <button
              onClick={() => setShowTokenSelector('to')}
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

        {/* Preview Info */}
        {preview && (
          <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Price:</span>
                <span className="text-white">1 {fromToken.symbol} = {preview.price.toFixed(6)} {toToken.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Slippage:</span>
                <span className="text-white">{preview.slippage.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">LP Fee:</span>
                <span className="text-white">{formatTokenAmount(preview.lp_fee, fromToken.decimals)} {fromToken.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gas Fee:</span>
                <span className="text-white">{formatTokenAmount(preview.gas_fee, fromToken.decimals)} {fromToken.symbol}</span>
              </div>
            </div>
          </div>
        )}

        {/* Slippage Settings */}
        <div className="space-y-2">
          <div className="text-slate-300 text-sm font-medium">Slippage Tolerance</div>
          <div className="flex gap-2">
            {[0.1, 0.5, 1.0].map((value) => (
              <button
                key={value}
                onClick={() => setSlippage(value)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  slippage === value 
                    ? "bg-purple-600 text-white" 
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {value}%
              </button>
            ))}
          </div>
        </div>

        {/* Swap Button */}
        <Button
          onClick={handleSwap}
          disabled={!fromAmount || !preview || isLoading || isPolling}
          className={`w-full py-4 text-lg font-medium disabled:cursor-not-allowed rounded-xl ${
            fromAmount && toAmount && !isLoading && !isPolling
              ? "bg-purple-600 hover:bg-purple-700 text-white"
              : "bg-slate-800 hover:bg-slate-700 text-white disabled:bg-slate-600"
          }`}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Processing...
            </div>
          ) : isPolling ? (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 animate-pulse" />
              Swapping...
            </div>
          ) : (
            `Swap ${fromToken.symbol} for ${toToken.symbol}`
          )}
        </Button>

        {/* Status Display */}
        {swapStatus && (
          <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className={`font-medium ${
                  swapStatus.success ? 'text-green-400' : 
                  swapStatus.status === 'pending' ? 'text-yellow-400' : 
                  'text-red-400'
                }`}>
                  {swapStatus.status || 'Unknown'}
                </span>
              </div>
              {swapStatus.request_id && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Request ID:</span>
                  <span className="text-white font-mono">{swapStatus.request_id}</span>
                </div>
              )}
              {swapStatus.error && (
                <div className="text-red-400 text-xs">
                  Error: {swapStatus.error}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Token Selector Modal */}
      {showTokenSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-white text-lg font-semibold">Select a token</h3>
              <button
                onClick={() => setShowTokenSelector(null)}
                className="p-1 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
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
                  {KONGSWAP_TOKENS.map((token) => (
                    <button
                      key={token.symbol}
                      onClick={() => {
                        if (showTokenSelector === 'from') {
                          setFromToken(token)
                        } else {
                          setToToken(token)
                        }
                        setShowTokenSelector(null)
                      }}
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
