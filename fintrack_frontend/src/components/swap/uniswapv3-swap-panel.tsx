"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowUpDown, Settings, TrendingUp, AlertCircle, ExternalLink, Info } from "lucide-react"
import { 
  getBestQuoteV3, 
  buildSwapCalldataV3, 
  SEPOLIA_TOKENS_V3, 
  FEE_AMOUNTS,
  fromReadableAmount, 
  calculateAmountOutMin, 
  createDeadline, 
  formatAmount, 
  buildApprovalCalldataV3, 
  isApprovalNeededV3,
  estimateSwapGasV3,
  PERMIT2_ADDRESS
} from "@/utils/uniswapv3"
import { Token } from "@uniswap/sdk-core"
import { uniswapService, ethereumService, authService } from "@/services/backend"
import { ethers } from "ethers"

interface TokenInfo {
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

export function UniswapV3SwapPanel() {
  const [fromToken, setFromToken] = useState<TokenInfo>({
    symbol: "ETH",
    name: "Ethereum",
    icon: "Ξ",
    balance: "0.00",
    decimals: 18,
    address: "0x0000000000000000000000000000000000000000"
  })
  const [toToken, setToToken] = useState<TokenInfo>({
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
    fee: number
    poolAddress: string
  } | null>(null)
  const [poolAvailable, setPoolAvailable] = useState<boolean | null>(null)
  const [poolCheckError, setPoolCheckError] = useState<string | null>(null)
  const [userEthAddress, setUserEthAddress] = useState<string>("")
  const [isConnected, setIsConnected] = useState(false)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [selectedFee, setSelectedFee] = useState<number>(FEE_AMOUNTS.MEDIUM) // Default to 0.3%

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
            console.log("User ETH address:", result.data)
          } else {
            console.error("Failed to get ETH address:", result.error)
            setIsConnected(false)
          }
        } else {
          setIsConnected(false)
        }
      } catch (error) {
        console.error("Error getting ETH address:", error)
        setIsConnected(false)
      }
    }

    getUserEthAddress()
  }, [])

  // Provider for Sepolia
  const provider = new ethers.providers.JsonRpcProvider(SEPOLIA_RPC_URL)

  // Fetch balances for all tokens
  const fetchBalances = async (address: string) => {
    if (!address) return
    
    setIsLoadingBalance(true)
    try {
      // ETH balance
      const ethBalance = await provider.getBalance(address)
      const ethFormatted = ethers.utils.formatEther(ethBalance)
      
      // USDC balance
      const usdcContract = new ethers.Contract(
        SEPOLIA_TOKENS_V3.USDC.address,
        ERC20_ABI,
        provider
      )
      const usdcBalance = await usdcContract.balanceOf(address)
      const usdcFormatted = ethers.utils.formatUnits(usdcBalance, 6)
      
      // WETH balance
      const wethContract = new ethers.Contract(
        SEPOLIA_TOKENS_V3.WETH.address,
        ERC20_ABI,
        provider
      )
      const wethBalance = await wethContract.balanceOf(address)
      const wethFormatted = ethers.utils.formatEther(wethBalance)

      // Update balances based on current token selection
      setFromToken(prev => ({
        ...prev,
        balance: prev.symbol === "ETH" ? ethFormatted : 
                prev.symbol === "USDC" ? usdcFormatted : 
                prev.symbol === "WETH" ? wethFormatted : "0.00"
      }))
      
      setToToken(prev => ({
        ...prev,
        balance: prev.symbol === "ETH" ? ethFormatted : 
                prev.symbol === "USDC" ? usdcFormatted : 
                prev.symbol === "WETH" ? wethFormatted : "0.00"
      }))
      
    } catch (error) {
      console.error("Error fetching balances:", error)
    } finally {
      setIsLoadingBalance(false)
    }
  }

  // Fetch balances when address is available
  useEffect(() => {
    if (userEthAddress) {
      fetchBalances(userEthAddress)
    }
  }, [userEthAddress])

  // Handle quote request
  const handleGetQuote = async () => {
    if (!fromAmount || !provider) return
    
    setIsQuoting(true)
    try {
      console.log("Starting V3 quote for:", { fromToken: fromToken.symbol, toToken: toToken.symbol, fromAmount })
      
      const amountIn = fromReadableAmount(parseFloat(fromAmount), fromToken.decimals)
      console.log("Parsed amount:", amountIn)
      
      // Convert ETH to WETH for V3 compatibility
      const fromTokenV3 = fromToken.symbol === 'ETH' ? SEPOLIA_TOKENS_V3.WETH : SEPOLIA_TOKENS_V3[fromToken.symbol as keyof typeof SEPOLIA_TOKENS_V3];
      const toTokenV3 = toToken.symbol === 'ETH' ? SEPOLIA_TOKENS_V3.WETH : SEPOLIA_TOKENS_V3[toToken.symbol as keyof typeof SEPOLIA_TOKENS_V3];
      
      const quoteResult = await getBestQuoteV3(
        fromTokenV3 as Token,
        toTokenV3 as Token,
        amountIn,
        provider
      )
      
      console.log("V3 Quote success:", quoteResult)
      
      setQuote({
        amountOut: quoteResult.amountOut,
        priceImpact: quoteResult.priceImpact.toFixed(2),
        route: quoteResult.route,
        fee: quoteResult.fee,
        poolAddress: quoteResult.poolAddress
      })
      
      // Format the amount for display
      const formattedAmount = formatAmount(quoteResult.amountOut, toToken.decimals)
      setToAmount(formattedAmount)
      
      // Pool is available if we got a quote
      setPoolAvailable(true)
      setPoolCheckError(null)
      
    } catch (error: any) {
      console.error("V3 Quote failed:", error)
      
      // Check if error is related to pool availability
      if (error.message && error.message.includes("No available pools found")) {
        setPoolAvailable(false)
        setPoolCheckError(error.message)
      } else {
        setPoolAvailable(null)
        setPoolCheckError(error.message || "Quote failed")
      }
      
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
  }, [fromAmount, fromToken, toToken, selectedFee])

  const handleSwap = async () => {
    if (!fromAmount || !toAmount || !quote) return
    
    setIsLoading(true)
    try {
      const amountIn = fromReadableAmount(parseFloat(fromAmount), fromToken.decimals)
      const amountOutMin = calculateAmountOutMin(quote.amountOut, slippage[0])
      const deadline = createDeadline(20)
      
      console.log("Starting V3 swap:", {
        fromToken: fromToken.symbol,
        toToken: toToken.symbol,
        amountIn,
        amountOutMin,
        fee: quote.fee
      })

      // Check if approval is needed
      const fromTokenObj = fromToken.symbol === 'ETH' ? SEPOLIA_TOKENS_V3.WETH : SEPOLIA_TOKENS_V3[fromToken.symbol as keyof typeof SEPOLIA_TOKENS_V3];
      if (isApprovalNeededV3((fromTokenObj as Token).address)) {
        console.log("Approval needed for token:", fromToken.symbol)
        
        const approvalCalldata = buildApprovalCalldataV3(
          (fromTokenObj as Token).address,
          PERMIT2_ADDRESS, // Spender is Permit2 (ERC20 approval to Permit2)
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
          
          // Wait for approval to be mined
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          // Get fresh nonce for swap transaction
          console.log("Getting fresh nonce after approval...")
          await uniswapService.getFreshNonce()
        }
      }

      // Build swap calldata
      const toTokenObj = toToken.symbol === 'ETH' ? SEPOLIA_TOKENS_V3.WETH : SEPOLIA_TOKENS_V3[toToken.symbol as keyof typeof SEPOLIA_TOKENS_V3];
      const swapCalldata = await buildSwapCalldataV3(
        fromTokenObj as Token,
        toTokenObj as Token,
        amountIn,
        amountOutMin,
        userEthAddress,
        quote.fee,
        slippage[0],
        deadline,
        provider
      )

      console.log("V3 Swap calldata:", swapCalldata)

      // Send swap transaction
      const swapResult = await uniswapService.sendTx({
        to: swapCalldata.to,
        data: swapCalldata.data,
        value: BigInt(swapCalldata.value)
      })

      if (!swapResult.success) {
        throw new Error(`Swap failed: ${swapResult.error}`)
      }

      console.log("V3 Swap transaction hash:", swapResult.data)
      
      // Refresh balances after successful swap
      await fetchBalances(userEthAddress)
      
      // Reset form
      setFromAmount("")
      setToAmount("")
      setQuote(null)
      
    } catch (error: any) {
      console.error("V3 Swap failed:", error)
      alert(`Swap failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSwapTokens = () => {
    const temp = fromToken
    setFromToken(toToken)
    setToToken(temp)
    setFromAmount("")
    setToAmount("")
    setQuote(null)
  }

  const handleMaxClick = () => {
    setFromAmount(fromToken.balance)
  }

  return (
    <Card className="w-full max-w-md mx-auto bg-slate-900 border-slate-700">
      <CardHeader className="pb-4">
        <CardTitle className="text-white text-xl font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          Uniswap V3 Swap
        </CardTitle>
        <div className="text-sm text-slate-400">
          {isConnected ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Connected: {userEthAddress.slice(0, 6)}...{userEthAddress.slice(-4)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-400 rounded-full"></div>
              <span>Not connected</span>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* From Token */}
        <div className="space-y-2">
          <Label className="text-slate-300 text-sm">From</Label>
          <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-lg">{fromToken.icon}</span>
              <span className="text-white font-medium">{fromToken.symbol}</span>
            </div>
            <div className="text-right">
              <Input
                type="number"
                placeholder="0.0"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className="bg-transparent border-none text-white text-right placeholder-slate-500 focus:ring-0 p-0 h-auto"
              />
              <div className="text-xs text-slate-400">
                Balance: {isLoadingBalance ? "Loading..." : `${parseFloat(fromToken.balance).toFixed(4)} ${fromToken.symbol}`}
                {parseFloat(fromToken.balance) > 0 && (
                  <button
                    onClick={handleMaxClick}
                    className="ml-1 text-blue-400 hover:text-blue-300"
                  >
                    MAX
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSwapTokens}
            className="p-2 hover:bg-slate-700 rounded-full"
          >
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
          </Button>
        </div>

        {/* To Token */}
        <div className="space-y-2">
          <Label className="text-slate-300 text-sm">To</Label>
          <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-lg">{toToken.icon}</span>
              <span className="text-white font-medium">{toToken.symbol}</span>
            </div>
            <div className="text-right">
              <div className="text-white text-right">
                {isQuoting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm">Getting quote...</span>
                  </div>
                ) : (
                  toAmount || "0.0"
                )}
              </div>
              <div className="text-xs text-slate-400">
                Balance: {isLoadingBalance ? "Loading..." : `${parseFloat(toToken.balance).toFixed(4)} ${toToken.symbol}`}
              </div>
            </div>
          </div>
        </div>

        {/* Fee Tier Selection */}
        <div className="space-y-2">
          <Label className="text-slate-300 text-sm">Fee Tier</Label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { fee: FEE_AMOUNTS.LOW, label: "0.05%", desc: "Best for stable pairs" },
              { fee: FEE_AMOUNTS.MEDIUM, label: "0.3%", desc: "Most common" },
              { fee: FEE_AMOUNTS.HIGH, label: "1%", desc: "Exotic pairs" }
            ].map(({ fee, label, desc }) => (
              <button
                key={fee}
                onClick={() => setSelectedFee(fee)}
                className={`p-2 rounded-lg border text-sm ${
                  selectedFee === fee
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                }`}
                title={desc}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Quote Info */}
        {quote && (
          <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
            <div className="text-sm text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span>Route:</span>
                <span className="text-white">{quote.route}</span>
              </div>
              <div className="flex justify-between">
                <span>Price Impact:</span>
                <span className="text-white">{quote.priceImpact}%</span>
              </div>
              <div className="flex justify-between">
                <span>Pool Address:</span>
                <a
                  href={`https://sepolia.etherscan.io/address/${quote.poolAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  {quote.poolAddress.slice(0, 6)}...{quote.poolAddress.slice(-4)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Pool Availability Info */}
        {poolAvailable === false && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-200">
              <p className="font-medium">Pool Not Available</p>
              <p>{poolCheckError}</p>
              <p className="mt-1 text-xs">Try different tokens or fee tiers.</p>
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

        {/* Info */}
        <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-200">
            <p className="font-medium">Uniswap V3</p>
            <p>Using V3 SDK with multiple fee tiers and concentrated liquidity.</p>
          </div>
        </div>

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
