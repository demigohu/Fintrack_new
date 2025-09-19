"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowUpDown, Settings, TrendingUp, AlertCircle, ExternalLink } from "lucide-react"
import { buildSwapCalldata, estimateAmountOut, SEPOLIA_TOKENS, parseAmount, calculateAmountOutMin, createDeadline, formatAmount, buildApprovalCalldata, isApprovalNeeded } from "@/utils/uniswap"
import { uniswapService, ethereumService, authService } from "@/services/backend"
import { ethers } from "ethers"

interface Token {
  symbol: string
  name: string
  icon: string
  balance: string
  decimals: number
  address: string
}

// ERC20 ABI for balance checking
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
]

// Sepolia RPC URL
const SEPOLIA_RPC_URL = "https://sepolia.infura.io/v3/76cf79a022694d02839ffa1827307d27"

export function UniswapSwapPanel() {
  const [fromToken, setFromToken] = useState<Token>({
    symbol: "ETH",
    name: "Ethereum",
    icon: "Ξ",
    balance: "0.00",
    decimals: 18,
    address: "0x0000000000000000000000000000000000000000"
  })
  const [toToken, setToToken] = useState<Token>({
    symbol: "USDC",
    name: "USD Coin",
    icon: "$",
    balance: "0.00",
    decimals: 6,
    address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
  })
  const [fromAmount, setFromAmount] = useState("")
  const [toAmount, setToAmount] = useState("")
  const [slippage, setSlippage] = useState([0.5])
  const [isLoading, setIsLoading] = useState(false)
  const [isQuoting, setIsQuoting] = useState(false)
  const [quote, setQuote] = useState<{
    amountOut: string
    priceImpact: string
    route: string
    feeTier?: number
  } | null>(null)
  const [poolAvailable, setPoolAvailable] = useState<boolean | null>(null)
  const [poolCheckError, setPoolCheckError] = useState<string | null>(null)
  const [userEthAddress, setUserEthAddress] = useState<string>("")
  const [isConnected, setIsConnected] = useState(false)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)

  // Get user's ETH address from principal
  useEffect(() => {
    const getUserEthAddress = async () => {
      try {
        const isAuth = await authService.isAuthenticated()
        if (isAuth) {
          const result = await ethereumService.deriveEthAddress()
          if (result.success) {
            setUserEthAddress(result.data)
            setIsConnected(true)
            // Fetch balances after getting address
            fetchBalances(result.data)
          }
        }
      } catch (error) {
        console.error("Failed to get ETH address:", error)
      }
    }
    getUserEthAddress()
  }, [])

  // Fetch token balances
  const fetchBalances = async (address: string) => {
    if (!address) return
    
    setIsLoadingBalance(true)
    try {
      const provider = new ethers.providers.JsonRpcProvider(SEPOLIA_RPC_URL)
      
      // Fetch ETH balance
      const ethBalance = await provider.getBalance(address)
      const ethBalanceFormatted = ethers.utils.formatEther(ethBalance)
      
      // Fetch USDC balance
      const usdcContract = new ethers.Contract(
        "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        ERC20_ABI,
        provider
      )
      const usdcBalance = await usdcContract.balanceOf(address)
      const usdcBalanceFormatted = ethers.utils.formatUnits(usdcBalance, 6)
      
      // Update balances for both tokens
      setFromToken(prev => ({
        ...prev,
        balance: prev.symbol === "ETH" 
          ? parseFloat(ethBalanceFormatted).toFixed(4)
          : prev.symbol === "USDC" 
            ? parseFloat(usdcBalanceFormatted).toFixed(4)
            : prev.balance
      }))
      
      setToToken(prev => ({
        ...prev,
        balance: prev.symbol === "ETH" 
          ? parseFloat(ethBalanceFormatted).toFixed(4)
          : prev.symbol === "USDC" 
            ? parseFloat(usdcBalanceFormatted).toFixed(4)
            : prev.balance
      }))
      
      // Fetch WETH balance
      const wethContract = new ethers.Contract(
        "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
        ERC20_ABI,
        provider
      )
      const wethBalance = await wethContract.balanceOf(address)
      const wethBalanceFormatted = ethers.utils.formatEther(wethBalance)
      
      if (fromToken.symbol === "WETH") {
        setFromToken(prev => ({ ...prev, balance: parseFloat(wethBalanceFormatted).toFixed(4) }))
      }
      if (toToken.symbol === "WETH") {
        setToToken(prev => ({ ...prev, balance: parseFloat(wethBalanceFormatted).toFixed(4) }))
      }
      
    } catch (error) {
      console.error("Failed to fetch balances:", error)
    } finally {
      setIsLoadingBalance(false)
    }
  }

  // Create provider for Sepolia
  const provider = new ethers.providers.JsonRpcProvider(SEPOLIA_RPC_URL)

  const handleSwapTokens = () => {
    const temp = fromToken
    setFromToken(toToken)
    setToToken(temp)
    setFromAmount(toAmount)
    setToAmount(fromAmount)
    setQuote(null)
    // Refresh balances after swap
    if (userEthAddress) {
      fetchBalances(userEthAddress)
    }
  }

  const handleGetQuote = async () => {
    if (!fromAmount || !provider) {
      console.log("Cannot get quote:", { fromAmount, provider: !!provider })
      return
    }
    
    setIsQuoting(true)
    try {
      console.log("Starting quote for:", { fromToken: fromToken.symbol, toToken: toToken.symbol, fromAmount })
      
      const amountIn = parseAmount(fromAmount, fromToken.decimals)
      console.log("Parsed amount:", amountIn)
      
      const quoteResult = await estimateAmountOut(
        SEPOLIA_TOKENS[fromToken.symbol as keyof typeof SEPOLIA_TOKENS],
        SEPOLIA_TOKENS[toToken.symbol as keyof typeof SEPOLIA_TOKENS],
        amountIn,
        provider
      )
      
      console.log("Quote success:", quoteResult)
      
      setQuote({
        amountOut: quoteResult.amountOut,
        priceImpact: quoteResult.priceImpact.toFixed(2),
        route: quoteResult.route,
        feeTier: quoteResult.feeTier
      })
      
      // Format the amount for display (convert from raw amount to human-readable)
      const formattedAmount = formatAmount(quoteResult.amountOut, toToken.decimals)
      setToAmount(formattedAmount)
    } catch (error: any) {
      console.error("Quote failed:", error)
      
      // Check if error is related to pool availability
      if (error.message && error.message.includes("No available pools found")) {
        setPoolAvailable(false)
        setPoolCheckError(error.message)
      } else {
        setPoolAvailable(null)
        setPoolCheckError(error.message || "Quote failed")
      }
      
      // Show error to user
      setQuote(null)
      setToAmount("")
    } finally {
      setIsQuoting(false)
    }
  }

  // Auto-quote when amount changes
  useEffect(() => {
    // Reset pool availability state when tokens change
    setPoolAvailable(null)
    setPoolCheckError(null)
    
    if (fromAmount && provider) {
      const timeoutId = setTimeout(() => {
        handleGetQuote()
      }, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [fromAmount, fromToken, toToken])

  const handleSwap = async () => {
    if (!fromAmount || !toAmount || !quote) return
    
    setIsLoading(true)
    try {
      const amountIn = parseAmount(fromAmount, fromToken.decimals)
      const amountOutMin = calculateAmountOutMin(quote.amountOut, slippage[0])
      const deadline = createDeadline(20)
      const fromTokenObj = SEPOLIA_TOKENS[fromToken.symbol as keyof typeof SEPOLIA_TOKENS]

      // Check if approval is needed for non-ETH tokens
      if (isApprovalNeeded(fromTokenObj.address)) {
        console.log("Approval needed for token:", fromToken.symbol)
        
        // Build approval calldata
        const approvalCalldata = buildApprovalCalldata(
          fromTokenObj.address,
          "0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b", // Universal Router address
          amountIn
        )

        if (approvalCalldata) {
          console.log("Sending approval transaction...", {
            to: approvalCalldata.to,
            data: approvalCalldata.data,
            value: approvalCalldata.value,
            amountIn,
            fromToken: fromToken.symbol
          })
          
          const approvalResult = await uniswapService.sendApprovalTx({
            to: approvalCalldata.to,
            data: approvalCalldata.data,
            value: BigInt(approvalCalldata.value)
          })

          if (!approvalResult.success) {
            throw new Error(`Approval failed: ${approvalResult.error}`)
          }
          console.log("Approval successful:", approvalResult.data)
          
          // Wait a bit for approval to be mined
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          // Get fresh nonce after approval
          console.log("Getting fresh nonce after approval...")
          const nonceResult = await uniswapService.getFreshNonce()
          if (nonceResult.success) {
            console.log("Fresh nonce:", nonceResult.data)
          } else {
            console.warn("Failed to get fresh nonce:", nonceResult.error)
          }
        }
      }

      // Build swap calldata using the same fee tier as the quote
      const calldata = buildSwapCalldata({
        tokenIn: fromTokenObj,
        tokenOut: SEPOLIA_TOKENS[toToken.symbol as keyof typeof SEPOLIA_TOKENS],
        amountIn,
        amountOutMin,
        recipient: userEthAddress, // User's ETH address derived from principal
        slippage: slippage[0],
        deadline
      }, quote.feeTier)

      // Send swap transaction to backend
      const result = await uniswapService.sendTx({
        to: calldata.to,
        data: calldata.data,
        value: BigInt(calldata.value)
      })

      if (result.success) {
        console.log("Swap transaction hash:", result.data)
        // Reset amounts after successful swap
        setFromAmount("")
        setToAmount("")
        setQuote(null)
        // Refresh balances
        if (userEthAddress) {
          await fetchBalances(userEthAddress)
        }
      } else {
        console.error("Swap failed:", result.error)
      }
    } catch (error) {
      console.error("Swap failed:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getTokenIcon = (token: Token) => {
    if (token.symbol === "ETH") {
      return <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white">Ξ</div>
    } else if (token.symbol === "USDC") {
      return <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold text-white">$</div>
    } else if (token.symbol === "WETH") {
      return <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center text-xs font-bold text-white">W</div>
    }
    return <div className="w-6 h-6 bg-gray-500 rounded-full"></div>
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            Uniswap Swap
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {/* User ETH Address Display */}
        {isConnected && userEthAddress && (
          <div className="mt-2 p-2 bg-slate-900/50 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Your ETH Address:</span>
              <span className="text-xs text-blue-400 font-mono">
                {userEthAddress.slice(0, 6)}...{userEthAddress.slice(-4)}
              </span>
            </div>
          </div>
        )}
        {!isConnected && (
          <div className="mt-2 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
            <span className="text-xs text-red-400">Please connect your wallet to swap</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* From Token */}
        <div className="space-y-2">
          <Label className="text-slate-300">From</Label>
          <div className="flex items-center gap-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 flex-1">
              {getTokenIcon(fromToken)}
              <select 
                value={fromToken.symbol} 
                onChange={(e) => {
                  const newToken = {
                    symbol: e.target.value,
                    name: e.target.value === "ETH" ? "Ethereum" : e.target.value === "USDC" ? "USD Coin" : "Wrapped Ether",
                    icon: e.target.value === "ETH" ? "Ξ" : e.target.value === "USDC" ? "$" : "W",
                    balance: "0.00",
                    decimals: e.target.value === "USDC" ? 6 : 18,
                    address: e.target.value === "ETH" ? "0x0000000000000000000000000000000000000000" : 
                             e.target.value === "USDC" ? "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" : 
                             "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
                  }
                  setFromToken(newToken)
                  setQuote(null)
                  // Refresh balance for new token
                  if (userEthAddress) {
                    fetchBalances(userEthAddress)
                  }
                }}
                className="w-auto bg-transparent border-none text-white focus:outline-none"
              >
                <option value="ETH" className="bg-slate-800 text-white">ETH</option>
                <option value="USDC" className="bg-slate-800 text-white">USDC</option>
                <option value="WETH" className="bg-slate-800 text-white">WETH</option>
              </select>
            </div>
            <div className="flex flex-col items-end">
              <Input
                type="number"
                placeholder="0.0"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className="bg-transparent border-none text-right text-white text-lg placeholder:text-slate-500"
              />
              <span className="text-xs text-slate-400">Balance: {isLoadingBalance ? "Loading..." : fromToken.balance}</span>
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
              <select 
                value={toToken.symbol} 
                onChange={(e) => {
                  const newToken = {
                    symbol: e.target.value,
                    name: e.target.value === "ETH" ? "Ethereum" : e.target.value === "USDC" ? "USD Coin" : "Wrapped Ether",
                    icon: e.target.value === "ETH" ? "Ξ" : e.target.value === "USDC" ? "$" : "W",
                    balance: "0.00",
                    decimals: e.target.value === "USDC" ? 6 : 18,
                    address: e.target.value === "ETH" ? "0x0000000000000000000000000000000000000000" : 
                             e.target.value === "USDC" ? "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" : 
                             "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
                  }
                  setToToken(newToken)
                  setQuote(null)
                  // Refresh balance for new token
                  if (userEthAddress) {
                    fetchBalances(userEthAddress)
                  }
                }}
                className="w-auto bg-transparent border-none text-white focus:outline-none"
              >
                <option value="ETH" className="bg-slate-800 text-white">ETH</option>
                <option value="USDC" className="bg-slate-800 text-white">USDC</option>
                <option value="WETH" className="bg-slate-800 text-white">WETH</option>
              </select>
            </div>
            <div className="flex flex-col items-end">
              <Input
                type="number"
                placeholder="0.0"
                value={toAmount}
                onChange={(e) => setToAmount(e.target.value)}
                className="bg-transparent border-none text-right text-white text-lg placeholder:text-slate-500"
                disabled
              />
              <span className="text-xs text-slate-400">Balance: {isLoadingBalance ? "Loading..." : toToken.balance}</span>
            </div>
          </div>
        </div>

        {/* Quote Loading */}
        {isQuoting && (
          <div className="flex items-center justify-center gap-2 p-3 bg-slate-900/30 rounded-lg">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-slate-300">Getting quote...</span>
          </div>
        )}

        {/* Swap Details */}
        {quote && (
          <div className="space-y-2 p-3 bg-slate-900/30 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Rate</span>
              <span className="text-white">1 {fromToken.symbol} = {(parseFloat(formatAmount(quote.amountOut, toToken.decimals)) / parseFloat(fromAmount)).toFixed(6)} {toToken.symbol}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Price Impact</span>
              <span className="text-green-400">{quote.priceImpact}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Route</span>
              <span className="text-white text-xs">{quote.route}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Network Fee</span>
              <span className="text-white">~0.05%</span>
            </div>
          </div>
        )}

        {/* Slippage Settings */}
        <div className="space-y-2">
          <Label className="text-slate-300">Slippage Tolerance</Label>
          <div className="space-y-2">
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={slippage[0]}
              onChange={(e) => setSlippage([parseFloat(e.target.value)])}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>0.1%</span>
              <span className="text-white font-medium">{slippage[0]}%</span>
              <span>5%</span>
            </div>
          </div>
        </div>

        {/* Debug Info */}
        <div className="text-xs text-slate-500 space-y-1">
          <div>fromAmount: {fromAmount || "empty"}</div>
          <div>toAmount: {toAmount || "empty"}</div>
          <div>quote: {quote ? "exists" : "null"}</div>
          <div>isLoading: {isLoading ? "true" : "false"}</div>
          <div>isConnected: {isConnected ? "true" : "false"}</div>
        </div>

        {/* Pool Availability Info */}
        {poolAvailable === false && (
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-4">
            <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-200">
              <p className="font-medium">Pool Exists But Not Ready</p>
              <p className="text-xs text-yellow-300">
                Pools exist on Sepolia but have no liquidity. This is common on testnets.
              </p>
              <p className="mt-1 text-xs text-yellow-400">
                💡 Try using Uniswap V3 instead, or add liquidity to V4 pools first.
              </p>
            </div>
          </div>
        )}

        {/* Swap Button */}
        <Button
          onClick={handleSwap}
          disabled={!fromAmount || !toAmount || !quote || isLoading || !isConnected || poolAvailable === false}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-medium disabled:bg-slate-600 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Swapping...
            </div>
          ) : !isConnected ? (
            "Connect Wallet to Swap"
          ) : (
            `Swap ${fromToken.symbol} for ${toToken.symbol}`
          )}
        </Button>

        {/* Warning */}
        <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-yellow-200">
            <p className="font-medium">Testnet Warning</p>
            <p>You are trading on Ethereum Sepolia testnet. These are test tokens with no real value.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
