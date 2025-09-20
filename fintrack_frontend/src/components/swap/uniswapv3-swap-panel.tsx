"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowUpDown, Settings, TrendingUp, AlertCircle, ExternalLink, Info, ChevronDown, Search, X } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import Image from "next/image"
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
  buildERC20ApprovalCalldata, 
  isApprovalNeededV3,
  estimateSwapGasV3,
  PERMIT2_ADDRESS,
  UNIVERSAL_ROUTER_ADDRESS,
  checkPermit2Allowance
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

// Helper function to get asset logo
const getAssetLogo = (symbol: string) => {
  const logoMap: Record<string, string> = {
    'ETH': '/ethereum.svg',
    'USDC': '/usdc.svg',
    'WETH': '/weth.svg',
  }
  return logoMap[symbol] || '/ethereum.svg' // fallback
}

export function UniswapV3SwapPanel() {
  const { toast } = useToast()
  const [fromToken, setFromToken] = useState<TokenInfo>({
    symbol: "ETH",
    name: "Ethereum",
    icon: "ethereum",
    balance: "0.00",
    decimals: 18,
    address: "0x0000000000000000000000000000000000000000"
  })
  const [toToken, setToToken] = useState<TokenInfo>({
    symbol: "USDC",
    name: "USD Coin",
    icon: "usdc",
    balance: "0.00",
    decimals: 6,
    address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
  })
  const [fromAmount, setFromAmount] = useState("")
  const [toAmount, setToAmount] = useState("")
  const [slippage, setSlippage] = useState([1.0]) // Default 1% slippage
  const [showSlippageSettings, setShowSlippageSettings] = useState(false)
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
  const [showTokenSelector, setShowTokenSelector] = useState(false)
  const [tokenSelectorType, setTokenSelectorType] = useState<'from' | 'to'>('from')
  const [searchQuery, setSearchQuery] = useState("")
  const [availableTokens, setAvailableTokens] = useState<TokenInfo[]>([])

  // Initialize available tokens
  useEffect(() => {
    const tokens: TokenInfo[] = [
      {
        symbol: "ETH",
        name: "Ethereum",
        icon: "ethereum",
        balance: "0.00",
        decimals: 18,
        address: "0x0000000000000000000000000000000000000000"
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        icon: "usdc",
        balance: "0.00",
        decimals: 6,
        address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
      },
      {
        symbol: "WETH",
        name: "Wrapped Ethereum",
        icon: "weth",
        balance: "0.00",
        decimals: 18,
        address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
      }
    ]
    setAvailableTokens(tokens)
  }, [])

  // Filter tokens based on search query
  const filteredTokens = availableTokens.filter(token =>
    token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Handle token selection
  const handleTokenSelect = (token: TokenInfo) => {
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

      // Update available tokens with real balances
      setAvailableTokens(prev => prev.map(token => {
        if (token.symbol === "ETH") {
          return { ...token, balance: ethFormatted }
        } else if (token.symbol === "USDC") {
          return { ...token, balance: usdcFormatted }
        } else if (token.symbol === "WETH") {
          return { ...token, balance: wethFormatted }
        }
        return token
      }))

      // Update current selected tokens
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
      toast({
        title: "Error",
        description: "Failed to fetch token balances",
        variant: "destructive"
      })
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
        toast({
          title: "No Pool Available",
          description: "No liquidity pool found for this token pair. Try different tokens.",
          variant: "destructive"
        })
      } else {
        setPoolAvailable(null)
        setPoolCheckError(error.message || "Quote failed")
        toast({
          title: "Quote Failed",
          description: error.message || "Failed to get quote. Please try again.",
          variant: "destructive"
        })
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
  }, [fromAmount, fromToken, toToken])

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
        expectedAmountOut: quote.amountOut,
        slippage: slippage[0],
        fee: quote.fee
      })
      
      console.log("Slippage calculation:", {
        expectedAmountOut: quote.amountOut,
        slippagePercent: slippage[0],
        amountOutMin: amountOutMin,
        slippageAmount: (parseFloat(quote.amountOut) * slippage[0] / 100).toString()
      })

      // Check if approval is needed for Permit2
      // For ETH: we need to approve WETH to Permit2 (after wrapping)
      // For tokens: we need to approve the token to Permit2
      const fromTokenObj = fromToken.symbol === 'ETH' ? SEPOLIA_TOKENS_V3.WETH : SEPOLIA_TOKENS_V3[fromToken.symbol as keyof typeof SEPOLIA_TOKENS_V3];
      const tokenToApprove = fromTokenObj; // Always use the actual token that will be transferred
      
      if (isApprovalNeededV3((tokenToApprove as Token).address)) {
        console.log("Checking allowances for token:", {
          fromTokenSymbol: fromToken.symbol,
          tokenToApproveSymbol: (tokenToApprove as Token).symbol,
          tokenToApproveAddress: (tokenToApprove as Token).address
        })
        
        // First: Check ERC20 allowance (token → Permit2)
        const erc20Contract = new ethers.Contract(
          (tokenToApprove as Token).address,
          ["function allowance(address owner, address spender) view returns (uint256)"],
          provider
        )
        
        const erc20Allowance = await erc20Contract.allowance(userEthAddress, PERMIT2_ADDRESS)
        console.log("Current ERC20 allowance (token → Permit2):", {
          amount: erc20Allowance.toString(),
          isSufficient: erc20Allowance.gte(amountIn)
        })
        
        // Second: Check Permit2 allowance (token → Universal Router)
        const permit2Allowance = await checkPermit2Allowance(
          (tokenToApprove as Token).address,
          userEthAddress,
          UNIVERSAL_ROUTER_ADDRESS, // Check allowance for Universal Router
          provider
        )
        
        console.log("Current Permit2 allowance (token → Universal Router):", {
          amount: permit2Allowance.amount,
          expiration: permit2Allowance.expiration,
          isValid: permit2Allowance.isValid,
          currentTime: Math.floor(Date.now() / 1000)
        })
        
        // Check if we need ERC20 approval (token → Permit2)
        const needsERC20Approval = erc20Allowance.lt(amountIn)
        
        // Check if we need Permit2 approval (token → Universal Router)
        const needsPermit2Approval = !permit2Allowance.isValid || ethers.BigNumber.from(permit2Allowance.amount).lt(amountIn)
        
        console.log("Approval status:", {
          needsERC20Approval,
          needsPermit2Approval,
          willProceed: !needsERC20Approval && !needsPermit2Approval
        })
        
        // If we need any approval
        if (needsERC20Approval || needsPermit2Approval) {
          console.log("Approval needed for token:", fromToken.symbol)
          
          // Show approval toast
          toast({
            title: "Approval Required",
            description: `Approving ${fromToken.symbol} for trading.`,
            variant: "info"
          })
          
          // First: ERC20 approval to Permit2 (if needed)
          if (needsERC20Approval) {
            console.log("ERC20 approval needed: token → Permit2")
            const erc20ApprovalCalldata = buildERC20ApprovalCalldata(
              (tokenToApprove as Token).address,
              PERMIT2_ADDRESS
            )
            
            if (erc20ApprovalCalldata) {
              console.log("Sending ERC20 approval to Permit2 (max amount)...", {
                to: erc20ApprovalCalldata.to,
                data: erc20ApprovalCalldata.data,
                value: erc20ApprovalCalldata.value,
                fromToken: fromToken.symbol,
                spender: PERMIT2_ADDRESS,
                contract: "ERC20"
              })
              
              const erc20ApprovalResult = await uniswapService.sendApprovalTx({
                to: erc20ApprovalCalldata.to,
                data: erc20ApprovalCalldata.data,
                value: BigInt(erc20ApprovalCalldata.value)
              })
              
              if (!erc20ApprovalResult.success) {
                throw new Error(`ERC20 approval failed: ${erc20ApprovalResult.error}`)
              }
              
              console.log("ERC20 approval to Permit2 successful:", erc20ApprovalResult.data)
              
              // Show approval success toast
              toast({
                title: "Approval Successful",
                description: `ERC20 approval completed for ${fromToken.symbol}`,
                variant: "success",
                action: (
                  <button
                    onClick={() => window.open(`https://sepolia.etherscan.io/tx/${erc20ApprovalResult.data}`, '_blank')}
                    className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    View TX
                  </button>
                )
              })
              
              // Wait for approval to be mined
              await new Promise(resolve => setTimeout(resolve, 3000))
              
              // Get fresh nonce after ERC20 approval
              console.log("Getting fresh nonce after ERC20 approval...")
              await uniswapService.getFreshNonce()
            }
          } else {
            console.log("ERC20 allowance is sufficient, skipping ERC20 approval")
          }
          
          // Second: Permit2 approval to Universal Router (if needed)
          if (needsPermit2Approval) {
            console.log("Permit2 approval needed: token → Universal Router")
            const approvalCalldata = buildApprovalCalldataV3(
              (tokenToApprove as Token).address,
              UNIVERSAL_ROUTER_ADDRESS, // Spender is Universal Router (Permit2 approval)
              "0" // amount parameter is ignored, max amount is used internally
            )
            
            if (approvalCalldata) {
              console.log("Sending Permit2 approval transaction (max amount)...", {
                to: approvalCalldata.to,
                data: approvalCalldata.data,
                value: approvalCalldata.value,
                fromToken: fromToken.symbol,
                spender: UNIVERSAL_ROUTER_ADDRESS,
                contract: "Permit2"
              })
              
              const approvalResult = await uniswapService.sendApprovalTx({
                to: approvalCalldata.to,
                data: approvalCalldata.data,
                value: BigInt(approvalCalldata.value)
              })
              
              if (!approvalResult.success) {
                throw new Error(`Permit2 approval failed: ${approvalResult.error}`)
              }
              
              console.log("Permit2 approval successful:", approvalResult.data)
              
              // Show approval success toast
              toast({
                title: "Approval Successful",
                description: `Permit2 approval completed for ${fromToken.symbol}`,
                variant: "success",
                action: (
                  <button
                    onClick={() => window.open(`https://sepolia.etherscan.io/tx/${approvalResult.data}`, '_blank')}
                    className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    View TX
                  </button>
                )
              })
              
              // Wait for approval to be mined
              await new Promise(resolve => setTimeout(resolve, 3000))
              
              // Get fresh nonce after Permit2 approval
              console.log("Getting fresh nonce after Permit2 approval...")
              await uniswapService.getFreshNonce()
            }
          } else {
            console.log("Permit2 allowance is sufficient, skipping Permit2 approval")
          }
          
          // Final: Get fresh nonce for swap transaction (after all approvals)
          console.log("Getting fresh nonce for swap transaction...")
          await uniswapService.getFreshNonce()
          
        } else {
          console.log("All allowances are valid, proceeding with swap")
        }
      }

      // Build swap calldata
      // For V3, we always use WETH internally, but need to know if original input was ETH
      const toTokenObj = toToken.symbol === 'ETH' ? SEPOLIA_TOKENS_V3.WETH : SEPOLIA_TOKENS_V3[toToken.symbol as keyof typeof SEPOLIA_TOKENS_V3];
      
      // If original input is ETH, we need WRAP_ETH command
      // If original input is WETH/token, we use token directly
      const isOriginalEthInput = fromToken.symbol === 'ETH';
      
      // If original output is ETH, we need UNWRAP_WETH command
      // If original output is WETH/token, we use token directly
      const isOriginalEthOutput = toToken.symbol === 'ETH';
      
      console.log("Swap parameters:", {
        fromTokenSymbol: fromToken.symbol,
        toTokenSymbol: toToken.symbol,
        isOriginalEthInput,
        isOriginalEthOutput,
        fromTokenObj: fromTokenObj.symbol,
        toTokenObj: toTokenObj.symbol
      });
      
      const swapCalldata = await buildSwapCalldataV3(
        fromTokenObj as Token,
        toTokenObj as Token,
        amountIn,
        amountOutMin,
        userEthAddress,
        FEE_AMOUNTS.MEDIUM, // Use default fee tier
        slippage[0],
        deadline,
        provider,
        isOriginalEthInput,
        isOriginalEthOutput
      )

      console.log("V3 Swap calldata:", swapCalldata)

      // Show transaction submitted toast
      toast({
        title: "Transaction Submitted",
        description: "Swap transaction has been submitted. Please wait for confirmation.",
        variant: "info"
      })

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
      
      // Show success toast with transaction hash and Etherscan link
      toast({
        title: "Swap Successful!",
        description: `Successfully swapped ${fromAmount} ${fromToken.symbol} for ${toAmount} ${toToken.symbol}`,
        variant: "success",
        action: (
          <button
            onClick={() => window.open(`https://sepolia.etherscan.io/tx/${swapResult.data}`, '_blank')}
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            View on Etherscan
          </button>
        )
      })
      
      // Refresh balances after successful swap
      await fetchBalances(userEthAddress)
      
      // Reset form
      setFromAmount("")
      setToAmount("")
      setQuote(null)
      
    } catch (error: any) {
      console.error("V3 Swap failed:", error)
      
      let errorMessage = error.message || "An error occurred during the swap"
      
      // Handle specific error cases
      if (error.message && error.message.includes("V3TooLittleReceived")) {
        errorMessage = "Swap failed due to slippage. The price moved unfavorably. Try increasing slippage tolerance or reducing the amount."
      } else if (error.message && error.message.includes("insufficient")) {
        errorMessage = "Insufficient balance or allowance. Please check your token balance and approvals."
      } else if (error.message && error.message.includes("deadline")) {
        errorMessage = "Transaction expired. Please try again."
      }
      
      toast({
        title: "Swap Failed",
        description: errorMessage,
        variant: "destructive"
      })
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

  const handlePercentageClick = (percentage: number) => {
    const balance = parseFloat(fromToken.balance)
    const amount = (balance * percentage / 100).toString()
    setFromAmount(amount)
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
              <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center">
                <Image
                  src={getAssetLogo(fromToken.symbol)}
                  alt={fromToken.symbol}
                  width={20}
                  height={20}
                  className="object-contain"
                />
              </div>
              <span className="text-white font-medium">{fromToken.symbol}</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          
          <div className="text-xs text-slate-400">
            Balance: {isLoadingBalance ? "Loading..." : `${parseFloat(fromToken.balance).toFixed(4)} ${fromToken.symbol}`}
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
                {isQuoting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm">Getting quote...</span>
                  </div>
                ) : (
                  toAmount || "0"
                )}
              </div>
            </div>
            <button
              onClick={() => openTokenSelector('to')}
              className="flex items-center gap-2 px-3 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg transition-colors"
            >
              <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center">
                <Image
                  src={getAssetLogo(toToken.symbol)}
                  alt={toToken.symbol}
                  width={20}
                  height={20}
                  className="object-contain"
                />
              </div>
              <span className="text-white font-medium">{toToken.symbol}</span>
              <ChevronDown className="w-4 h-4 text-white" />
            </button>
          </div>
          
          <div className="text-xs text-slate-400">
            Balance: {isLoadingBalance ? "Loading..." : `${parseFloat(toToken.balance).toFixed(4)} ${toToken.symbol}`}
          </div>
        </div>

        {/* Slippage Settings */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 text-sm font-medium">Slippage Tolerance</span>
            <button
              onClick={() => setShowSlippageSettings(!showSlippageSettings)}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-300 text-sm"
            >
              <Settings className="w-4 h-4" />
              {slippage[0]}%
            </button>
          </div>
          
          {showSlippageSettings && (
            <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
              <div className="space-y-3">
                <div className="text-sm text-slate-300">
                  Your transaction will revert if the price changes unfavorably by more than this percentage.
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[0.1, 0.5, 1.0, 2.0, 5.0].map((value) => (
                    <button
                      key={value}
                      onClick={() => setSlippage([value])}
                      className={`p-2 rounded-lg border text-sm ${
                        slippage[0] === value
                          ? "bg-blue-600 border-blue-500 text-white"
                          : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      {value}%
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Custom"
                    value={slippage[0]}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value)
                      if (!isNaN(value) && value >= 0 && value <= 50) {
                        setSlippage([value])
                      }
                    }}
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                    step="0.1"
                    min="0"
                    max="50"
                  />
                  <span className="text-slate-400 text-sm">%</span>
                </div>
              </div>
            </div>
          )}
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
          className={`w-full py-4 text-lg font-medium disabled:cursor-not-allowed rounded-xl ${
            quote && !isLoading && isConnected && fromAmount && toAmount
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-slate-800 hover:bg-slate-700 text-white disabled:bg-slate-600"
          }`}
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

        {/* Connection Status */}
        <div className="text-sm text-slate-400 text-center">
          {isConnected ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Connected: {userEthAddress.slice(0, 6)}...{userEthAddress.slice(-4)}</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-red-400 rounded-full"></div>
              <span>Not connected</span>
            </div>
          )}
        </div>

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
                        <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center">
                          <Image
                            src={getAssetLogo(token.symbol)}
                            alt={token.symbol}
                            width={28}
                            height={28}
                            className="object-contain"
                          />
                        </div>
                        <div className="text-left">
                          <div className="text-white font-medium">{token.name}</div>
                          <div className="text-slate-400 text-sm">
                            {token.symbol} {token.address !== "0x0000000000000000000000000000000000000000" && 
                              `${token.address.slice(0, 6)}...${token.address.slice(-4)}`}
                          </div>
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
