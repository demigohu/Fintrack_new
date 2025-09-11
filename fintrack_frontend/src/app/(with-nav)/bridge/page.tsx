"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import QRCode from 'qrcode'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast, Toaster } from "@/components/ui/use-toast"
import { balanceService, bitcoinService, ethereumService, authService, transactionService, networkService, feeService, budgetService } from "@/services/backend"
import { toDecimalStringNat, toDecimalStringBigInt, parseDecimalToBaseUnits, formatUsd } from "@/lib/utils"
import { getHelperContractAddress, depositEthToContract } from "@/services/ethDeposit"

export default function BridgePage() {
  const { toast } = useToast()

  const [fromToken, setFromToken] = useState<"BTC" | "ckBTC" | "ETH" | "ckETH">("BTC")
  const [toToken, setToToken] = useState<"BTC" | "ckBTC" | "ETH" | "ckETH">("ckBTC")
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [selectingFor, setSelectingFor] = useState<"from" | "to">("from")

  // Computed values based on selected tokens
  const assetType = useMemo(() => {
    return fromToken.includes("BTC") ? "BTC" : "ETH"
  }, [fromToken])
  
  const isDeposit = useMemo(() => {
    return (fromToken === "BTC" && toToken === "ckBTC") || (fromToken === "ETH" && toToken === "ckETH")
  }, [fromToken, toToken])
  
  const fromAsset = fromToken
  const toAsset = toToken

  const decimals = useMemo(() => (assetType === "BTC" ? 8 : 18), [assetType])
  const symbol = useMemo(() => (assetType === "BTC" ? "ckBTC" : "ckETH"), [assetType])

  const [balances, setBalances] = useState<{ ckbtc?: bigint; cketh?: bigint }>({})
  const [rates, setRates] = useState<{ btc_to_usd: number; eth_to_usd: number } | null>(null)

  const [depositAddress, setDepositAddress] = useState<string>("")
  const [loadingDepositAddress, setLoadingDepositAddress] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const [ethDepositAmount, setEthDepositAmount] = useState("")
  const [ethWallet, setEthWallet] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string>("")
  const [minterStatus, setMinterStatus] = useState<{ eth_finalized?: number; last_scraped?: number } | null>(null)
  const [btcNetworkInfo, setBtcNetworkInfo] = useState<{ last_seen_utxo_height: number | null; current_block_height: number | null } | null>(null)
  const [recentTxs, setRecentTxs] = useState<any[]>([])
  const [fees, setFees] = useState<{ ckbtc: bigint; cketh: bigint } | null>(null)
  
  // Withdraw states
  const [withdrawAddress, setWithdrawAddress] = useState("")
  const [withdrawAmount, setWithdrawAmount] = useState("")
  
  // ETH specific states
  const [ethGasFee, setEthGasFee] = useState<string>("")
  const [ethAllowance, setEthAllowance] = useState<string>("")


  const currentBalance = useMemo(() => {
    if (isDeposit) {
      // For deposit, we don't show balance (external wallet)
      return BigInt(0)
    } else {
      // For withdraw, show ckAsset balance
      return assetType === "BTC" ? (balances.ckbtc ?? BigInt(0)) : (balances.cketh ?? BigInt(0))
    }
  }, [isDeposit, assetType, balances])
  
  const currentRate = useMemo(() => {
    return assetType === "BTC" ? (rates?.btc_to_usd || 0) : (rates?.eth_to_usd || 0)
  }, [assetType, rates])

  async function loadBalances() {
    try {
      const res = await balanceService.getPortfolioSummary()
      if (res.success) {
        setBalances({ ckbtc: BigInt(res.data.ckbtc_balance), cketh: BigInt(res.data.cketh_balance) })
      }
    } catch {}
  }

  async function loadFees() {
    try {
      // Get ckBTC fee
      const ckbtcFee = await feeService.getCkbtcFee()
      // Get ckETH fee  
      const ckethFee = await feeService.getCkethFee()
      
      if (ckbtcFee.success && ckethFee.success) {
        setFees({ 
          ckbtc: BigInt(ckbtcFee.data), 
          cketh: BigInt(ckethFee.data) 
        })
      }
    } catch {}
  }

  async function loadEthGasFee() {
    if (assetType !== "ETH") return
    try {
      const gasFeeRes = await ethereumService.estimateWithdrawalFee()
      if (gasFeeRes.success) {
        const gasFeeWei = BigInt(gasFeeRes.data)
        const gasFeeEth = Number(gasFeeWei) / 1e18
        setEthGasFee(gasFeeEth.toFixed(6))
      }
    } catch (e) {
      console.error("Failed to load ETH gas fee:", e)
    }
  }

  async function loadEthAllowance() {
    if (assetType !== "ETH" || !withdrawAmount) return
    try {
      const amount = parseDecimalToBaseUnits(withdrawAmount, 18)
      if (!amount) return
      
      // Get allowance from preview requirements
      const previewRes = await budgetService.previewRequirements(
        "cketh-minter", 
        "CkEth", 
        amount
      )
      if (previewRes.success) {
        const allowanceWei = previewRes.data.allowance
        const allowanceEth = Number(allowanceWei) / 1e18
        setEthAllowance(allowanceEth.toFixed(6))
      }
    } catch (e) {
      console.error("Failed to load ETH allowance:", e)
    }
  }

  useEffect(() => {
    // Initial background loads
    loadBalances()
    loadFees()
    loadEthGasFee()
    ;(async () => {
      try {
        const r = await (await import("@/services/backend")).currencyService.getCurrencyRates()
        if (r.success) setRates({ btc_to_usd: r.data.btc_to_usd, eth_to_usd: r.data.eth_to_usd })
      } catch {}
      try {
        // Load recent transactions (bridge-related will still appear here)
        const tx = await transactionService.getTransactions()
        if (tx.success) setRecentTxs(tx.data.slice(0, 5))
      } catch {}
      try {
        const eth = await networkService.getEthNetworkStatus()
        console.log("[Bridge] Initial ETH network status:", eth)
        if (eth.success) setMinterStatus({ eth_finalized: eth.data.eth_finalized ?? undefined, last_scraped: eth.data.last_scraped ?? undefined })
      } catch {}
    })()
  }, [])

  useEffect(() => {
    // Load ETH allowance when withdraw amount changes
    if (assetType === "ETH" && withdrawAmount) {
      loadEthAllowance()
    }
  }, [assetType, withdrawAmount])

  useEffect(() => {
    // Clear addresses when switching tokens
    setDepositAddress("")
    setWithdrawAddress("")
    setWithdrawAmount("")
    setEthDepositAmount("")
    
    // Check login status and auto-fetch address
    ;(async () => {
      try {
        setLoadingDepositAddress(true)
        const authed = await authService.isAuthenticated()
        setIsLoggedIn(authed)
        
        if (authed && isDeposit) {
          if (assetType === "BTC") {
            const r = await bitcoinService.getBtcDepositAddress()
            if (r.success) setDepositAddress(r.data)
          } else {
            const addr = await getHelperContractAddress()
            if (addr) setDepositAddress(addr)
          }
        }
      } catch {}
      finally { setLoadingDepositAddress(false) }
    })()
  }, [fromToken, toToken, isDeposit, assetType])

  // Token data
  const tokens = [
    { symbol: "BTC", name: "Bitcoin", network: "Bitcoin", icon: "₿" },
    { symbol: "ckBTC", name: "ckBTC", network: "Internet Computer", icon: "₿IC" },
    { symbol: "ETH", name: "Ethereum", network: "Ethereum", icon: "ETH" },
    { symbol: "ckETH", name: "ckETH", network: "Internet Computer", icon: "ETHIC" }
  ]

  function handleSwapTokens() {
    // Swap tokens while maintaining valid pairs
    const temp = fromToken
    setFromToken(toToken)
    setToToken(temp)
  }

  function handleTokenSelect(tokenSymbol: string) {
    if (selectingFor === "from") {
      setFromToken(tokenSymbol as any)
      // Auto-select the paired token
      if (tokenSymbol === "BTC") {
        setToToken("ckBTC")
      } else if (tokenSymbol === "ckBTC") {
        setToToken("BTC")
      } else if (tokenSymbol === "ETH") {
        setToToken("ckETH")
      } else if (tokenSymbol === "ckETH") {
        setToToken("ETH")
      }
    } else {
      setToToken(tokenSymbol as any)
      // Auto-select the paired token
      if (tokenSymbol === "BTC") {
        setFromToken("ckBTC")
      } else if (tokenSymbol === "ckBTC") {
        setFromToken("BTC")
      } else if (tokenSymbol === "ETH") {
        setFromToken("ckETH")
      } else if (tokenSymbol === "ckETH") {
        setFromToken("ETH")
      }
    }
    setShowTokenModal(false)
  }

  function openTokenModal(forToken: "from" | "to") {
    setSelectingFor(forToken)
    setShowTokenModal(true)
  }

  // Get valid tokens for selection based on current selection
  function getValidTokens() {
    if (selectingFor === "from") {
      // If selecting "from" token, show tokens that can pair with current "to" token
      if (toToken === "BTC") {
        return tokens.filter(t => t.symbol === "ckBTC")
      } else if (toToken === "ckBTC") {
        return tokens.filter(t => t.symbol === "BTC")
      } else if (toToken === "ETH") {
        return tokens.filter(t => t.symbol === "ckETH")
      } else if (toToken === "ckETH") {
        return tokens.filter(t => t.symbol === "ETH")
      }
    } else {
      // If selecting "to" token, show tokens that can pair with current "from" token
      if (fromToken === "BTC") {
        return tokens.filter(t => t.symbol === "ckBTC")
      } else if (fromToken === "ckBTC") {
        return tokens.filter(t => t.symbol === "BTC")
      } else if (fromToken === "ETH") {
        return tokens.filter(t => t.symbol === "ckETH")
      } else if (fromToken === "ckETH") {
        return tokens.filter(t => t.symbol === "ETH")
      }
    }
    return tokens
  }

  async function handleMintCkbtc() {
    try {
      setActionLoading(true)
      const r = await bitcoinService.refreshBtcBalance()
      if (r.success) {
        toast({ title: "Minted", description: "Successfully minted BTC to ckBTC" })
        await loadBalances()
      } else {
        toast({ title: "Mint failed", description: r.error, variant: "destructive" })
      }
    } finally {
      setActionLoading(false)
    }
  }

  async function handleEthDeposit() {
    try {
      if (!ethDepositAmount || Number(ethDepositAmount) <= 0) {
        toast({ title: "Invalid amount", description: "Enter a valid ETH amount", variant: "destructive" })
        return
      }
      setActionLoading(true)
      const helper = await getHelperContractAddress()
      if (!helper) {
        toast({ title: "Error", description: "Failed to get deposit contract address", variant: "destructive" })
        return
      }
      const principal = await authService.getCurrentUser()
      if (!principal) {
        toast({ title: "Not authenticated", description: "Please login first", variant: "destructive" })
        return
      }
      const res = await depositEthToContract(helper, principal, ethDepositAmount)
      if (res.success) {
        toast({ title: "Deposit submitted", description: `Tx: ${res.data?.hash ?? "submitted"}` })
      } else {
        toast({ title: "Deposit failed", description: res.error || "Unknown error", variant: "destructive" })
      }
    } finally {
      setActionLoading(false)
    }
  }

  async function connectEthWallet() {
    try {
      const w = (window as any)
      if (!w || !w.ethereum) {
        toast({ title: "MetaMask not found", description: "Please install MetaMask", variant: "destructive" })
        return
      }
      const accounts = await w.ethereum.request({ method: "eth_requestAccounts" })
      if (accounts && accounts[0]) setEthWallet(accounts[0] as string)
    } catch (e: any) {
      toast({ title: "Connect failed", description: e?.message || "Unable to connect wallet", variant: "destructive" })
    }
  }

  // Generate QR for BTC deposit address when available
  useEffect(() => {
    ;(async () => {
      if (assetType !== "BTC" || !depositAddress || !isDeposit) { 
        setQrDataUrl(""); 
        return 
      }
      try {
        console.log("[Bridge] Generating QR for address:", depositAddress)
        const qrDataUrl = await QRCode.toDataURL(depositAddress, {
          width: 160,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        })
        setQrDataUrl(qrDataUrl)
      } catch (e) {
        console.error("[Bridge] QR generation failed:", e)
        setQrDataUrl("")
      }
    })()
  }, [assetType, depositAddress, isDeposit])

  // Real-time polling for network status (ckETH minter info + refresh recent txs)
  useEffect(() => {
    const tick = async () => {
      try {
        const eth = await networkService.getEthNetworkStatus()
        console.log("[Bridge] Poll ETH network status:", eth)
        if (eth.success) setMinterStatus({ eth_finalized: eth.data.eth_finalized ?? undefined, last_scraped: eth.data.last_scraped ?? undefined })
      } catch {}
      try {
        const tx = await transactionService.getTransactions()
        if (tx.success) setRecentTxs(tx.data.slice(0, 5))
      } catch {}
      try {
        // Get BTC network info including current block height and UTXO height
        if (assetType === "BTC") {
          const btc = await networkService.getBtcNetworkStatus(depositAddress || undefined)
          console.log("[Bridge] Poll BTC network status:", btc)
          if (btc.success) setBtcNetworkInfo(btc.data)
        }
      } catch {}
    }
    // fire immediately
    tick()
    const id = setInterval(tick, 5000)
    return () => clearInterval(id)
  }, [assetType, depositAddress])

  // Also refetch network status instantly when switching bridge direction
  useEffect(() => {
    ;(async () => {
      try {
        const eth = await networkService.getEthNetworkStatus()
        console.log("[Bridge] Direction switch ETH network status:", eth)
        if (eth.success) setMinterStatus({ eth_finalized: eth.data.eth_finalized ?? undefined, last_scraped: eth.data.last_scraped ?? undefined })
      } catch {}
      if (assetType === "BTC") {
        try {
          const btc = await networkService.getBtcNetworkStatus(depositAddress || undefined)
          console.log("[Bridge] Direction switch BTC network status:", btc)
          if (btc.success) setBtcNetworkInfo(btc.data)
        } catch {}
      }
    })()
  }, [assetType, depositAddress])

  function fillPercent(p: number) {
    const base = currentBalance
    const amt = (base * BigInt(p)) / BigInt(100)
    setWithdrawAmount(toDecimalStringBigInt(amt, decimals))
  }

  async function handleWithdraw() {
    try {
      if (!withdrawAddress) {
        toast({ title: "Address required", description: "Please enter recipient address", variant: "destructive" })
        return
      }
      const amount = parseDecimalToBaseUnits(withdrawAmount, decimals)
      if (!amount || amount <= BigInt(0)) {
        toast({ title: "Invalid amount", description: "Enter a valid amount", variant: "destructive" })
        return
      }
      setActionLoading(true)
      if (assetType === "BTC") {
        const approve = await bitcoinService.approveBtcWithdrawal(amount)
        if (!approve.success) {
          toast({ title: "Approve failed", description: approve.error, variant: "destructive" })
          return
        }
        const wd = await bitcoinService.withdrawBtc(withdrawAddress, amount)
        if (wd.success) {
          toast({ title: "Withdraw submitted", description: `ckBTC burn, BTC tx: ${wd.data}` })
          await loadBalances()
        } else {
          toast({ title: "Withdraw failed", description: wd.error, variant: "destructive" })
        }
      } else {
        const approve = await ethereumService.approveCkethWithdrawal(amount)
        if (!approve.success) {
          toast({ title: "Approve failed", description: approve.error, variant: "destructive" })
          return
        }
        const wd = await ethereumService.withdrawCketh(withdrawAddress, amount)
        if (wd.success) {
          toast({ title: "Withdraw submitted", description: "ckETH burn, ETH withdrawal requested" })
          await loadBalances()
        } else {
          toast({ title: "Withdraw failed", description: wd.error, variant: "destructive" })
        }
      }
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-900">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">Bridge</h1>
          </div>
        </div>

        {/* Your Balance */}
        <Card className="p-4 bg-slate-900/80 border-purple-500/20">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-slate-400 text-sm">Your Balance</div>
                <div className="text-white font-mono text-lg">
                  {assetType === "BTC" 
                    ? `${(Number(balances.ckbtc ?? BigInt(0)) / 1e8).toFixed(4)} ckBTC`
                    : `${(Number(balances.cketh ?? BigInt(0)) / 1e18).toFixed(4)} ckETH`
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Bridge Form */}
        <Card className="p-6 bg-slate-900/80 border-purple-500/20">
          <CardContent className="p-0">
            {/* Bridge Interface */}
            <div className="mb-6">
              <div className="text-center mb-4">
                <div className="text-slate-300 text-sm mb-4">Bridge {fromAsset} to {toAsset}</div>
                <div className="flex items-center justify-center gap-4">
                  {/* From Token Selector */}
                  <div className="relative">
                    <div 
                      className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-800/70 transition-colors"
                      onClick={() => openTokenModal("from")}
                    >
                      <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                        {fromAsset === "BTC" ? (
                          <span className="text-white text-sm font-bold">₿</span>
                        ) : fromAsset === "ETH" ? (
                          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223 12.056 7.026 19.31 12.223 12.056 0z"/>
                          </svg>
                        ) : fromAsset === "ckBTC" ? (
                          <span className="text-white text-xs font-bold">₿IC</span>
                        ) : (
                          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                        )}
                      </div>
                      <span className="text-white font-medium">{fromAsset}</span>
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Swap Button */}
                  <button 
                    onClick={handleSwapTokens}
                    className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center hover:bg-purple-700 transition-colors"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </button>

                  {/* To Token Selector */}
                  <div 
                    className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-800/70 transition-colors"
                    onClick={() => openTokenModal("to")}
                  >
                    <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                      {toAsset === "BTC" ? (
                        <span className="text-white text-sm font-bold">₿</span>
                      ) : toAsset === "ETH" ? (
                        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223 12.056 7.026 19.31 12.223 12.056 0z"/>
                        </svg>
                      ) : toAsset === "ckBTC" ? (
                        <span className="text-white text-xs font-bold">₿IC</span>
                      ) : (
                        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                      )}
                    </div>
                    <span className="text-white font-medium">{toAsset}</span>
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Wallet Connections - Only show MetaMask for ETH deposits */}
            {isDeposit && assetType === "ETH" && (
              <div className="mb-6">
                <div className="space-y-3">
                  <Label className="text-slate-300">Your wallet of MetaMask</Label>
                  <Button 
                    onClick={connectEthWallet} 
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {ethWallet ? `${ethWallet.slice(0,6)}...${ethWallet.slice(-4)}` : "Connect to MetaMask"}
                  </Button>
                </div>
              </div>
            )}

            {/* Amount Input - For all withdraws and ETH deposits, not for BTC deposits */}
            {(!isDeposit || assetType !== "BTC") && (
              <div className="space-y-3 mb-6">
              <Label className="text-slate-300">Amount ({fromAsset})</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input 
                    value={isDeposit && assetType === "ETH" ? ethDepositAmount : withdrawAmount} 
                    onChange={(e) => {
                      if (isDeposit && assetType === "ETH") {
                        setEthDepositAmount(e.target.value)
                      } else {
                        setWithdrawAmount(e.target.value)
                      }
                    }} 
                    placeholder="0.0" 
                    className="bg-slate-800/80 text-white text-xl h-12"
                  />
                </div>
                <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-2 rounded-lg">
                  <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                    {fromAsset === "BTC" ? (
                      <span className="text-white text-xs font-bold">₿</span>
                    ) : fromAsset === "ETH" ? (
                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223 12.056 7.026 19.31 12.223 12.056 0z"/>
                      </svg>
                    ) : fromAsset === "ckBTC" ? (
                      <span className="text-white text-xs font-bold">₿IC</span>
                    ) : (
                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                    )}
                  </div>
                  <span className="text-white font-medium">{fromAsset}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Balance: {!isDeposit ? `${(Number(currentBalance) / (assetType === "BTC" ? 1e8 : 1e18)).toFixed(4)} ${fromAsset}` : "--"}</span>
                {!isDeposit && (
                  <div className="flex gap-1">
                    <Button variant="link" className="text-blue-400 p-0 h-auto" onClick={() => fillPercent(25)}>25%</Button>
                    <Button variant="link" className="text-blue-400 p-0 h-auto" onClick={() => fillPercent(50)}>50%</Button>
                    <Button variant="link" className="text-blue-400 p-0 h-auto" onClick={() => fillPercent(75)}>75%</Button>
                    <Button variant="link" className="text-blue-400 p-0 h-auto" onClick={() => fillPercent(100)}>Max</Button>
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Deposit Address Section (for BTC deposits) */}
            {isDeposit && assetType === "BTC" && (
              <div className="space-y-4 mb-6">
                <div className="text-slate-300 text-sm">BTC deposit address</div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Input 
                        readOnly 
                        value={depositAddress} 
                        placeholder={loadingDepositAddress ? "Loading address..." : "Address will appear automatically"} 
                        className="bg-slate-800/80 text-slate-200 pr-12"
                      />
                      {depositAddress && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(depositAddress)
                            toast({ title: "Copied!", description: "Address copied to clipboard" })
                          }}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-slate-700 rounded"
                          title="Copy address"
                        >
                          <svg className="w-4 h-4 text-slate-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {depositAddress && (
                      <a 
                        href={`https://mempool.space/address/${depositAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 mt-1 cursor-pointer hover:underline"
                      >
                        Check on bitcoin explorer
                      </a>
                    )}
                  </div>
                  <div className="w-32 h-32 bg-white p-2 rounded">
                    {qrDataUrl ? (
                      <Image src={qrDataUrl} alt="BTC Deposit QR" width={128} height={128} className="w-full h-full" />
                    ) : (
                      <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-400 text-xs">
                        QR Code
                      </div>
                    )}
                  </div>
                </div>
                <Button 
                  onClick={handleMintCkbtc} 
                  disabled={actionLoading || !depositAddress} 
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {actionLoading ? "Checking..." : "Check for incoming BTC"}
                </Button>
              </div>
            )}

            {/* Withdraw Address Section */}
            {!isDeposit && (
              <div className="space-y-3 mb-6">
                <Label className="text-slate-300">Recipient ({toAsset} address)</Label>
                <Input 
                  value={withdrawAddress} 
                  onChange={(e) => setWithdrawAddress(e.target.value)} 
                  placeholder={toAsset === "BTC" ? "bc1q..." : "0x..."} 
                  className="bg-slate-800/80 text-slate-200"
                />
                <div className="text-xs text-slate-400">
                  {assetType === "BTC" ? (
                    <div>
                      <div>Withdrawal fee: {fees?.ckbtc ? toDecimalStringBigInt(fees.ckbtc, 8) : "0.00002"} ckBTC</div>
                      <div className="text-slate-500 mt-1">Fee (Excludes Bitcoin Network Tx fees)</div>
                    </div>
                  ) : (
                    <div>
                      <div>Withdrawal fee: {fees?.cketh ? toDecimalStringBigInt(fees.cketh, 18) : "~0.001"} ETH</div>
                      {ethGasFee && (
                        <div className="mt-1">
                          <div>Estimated gas fee: {ethGasFee} ETH</div>
                          {ethAllowance && (
                            <div>Current allowance: {ethAllowance} ETH</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Button */}
            {isDeposit ? (
              // Deposit actions
              assetType === "ETH" && (
                <Button 
                  onClick={handleEthDeposit} 
                  disabled={actionLoading || !ethDepositAmount} 
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {actionLoading ? "Submitting..." : "Deposit ETH"}
                </Button>
              )
            ) : (
              // Withdraw actions
              <Button 
                onClick={handleWithdraw} 
                disabled={actionLoading || !withdrawAmount || !withdrawAddress} 
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                {actionLoading ? "Submitting..." : `Approve & Withdraw ${toAsset}`}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Network Status */}
        <Card className="p-6 bg-slate-900/80 border-purple-500/20">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-white text-lg">Network status</CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-4">
            <div className="flex flex-wrap gap-4">
              <a href="#" className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
                {assetType === "BTC" ? "ckBTC canister" : "ckETH canister"}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <a href="#" className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
                {assetType === "BTC" ? "ckBTC Dashboard" : "ckETH Dashboard"}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              {assetType === "ETH" && (
                <a href="#" className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
                  ETH smart contract on the Ethereum network
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
            
            <div className="text-sm text-slate-300 space-y-1">
              {assetType === "ETH" ? (
                <>
                  <div>Ethereum finalized block height: {minterStatus?.eth_finalized ?? "--"}</div>
                  <div>Last synced block height (Ethereum): {minterStatus?.last_scraped ?? "--"}</div>
                </>
              ) : (
                <>
                  <div>Bitcoin network block height: {btcNetworkInfo?.current_block_height ?? "--"}</div>
                  <div>KYT Fee: 0.00002 ckBTC</div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card className="p-6 bg-slate-900/80 border-purple-500/20">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-white text-lg">Latest transactions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-sm text-slate-300 mb-4">
              {assetType === "BTC" ? (
                <>
                  After the IC&apos;s Bitcoin network syncs to the Bitcoin mainnet height and the transaction receives 6 block confirmations, your ckBTC balance will be updated accordingly.
                </>
              ) : (
                <>
                  Your ckETH balance will update once Ethereum sync is complete.
                </>
              )}
            </div>
            
            {recentTxs.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="text-slate-400 text-sm">No ckBridge activity yet</div>
              </div>
            ) : (
              <div className="space-y-2">
                {recentTxs
                  .filter((tx) => {
                    // Filter only bridge-related transactions (native ↔ ckAsset)
                    const unwrapOpt = (opt: any) => Array.isArray(opt) && opt.length ? opt[0] : undefined
                    const icp = unwrapOpt(tx.icp_tx)
                    const eth = unwrapOpt(tx.eth_tx)
                    const btc = unwrapOpt(tx.btc_tx)
                    
                    // Only show DEPOSIT and WITHDRAW operations (bridge transactions)
                    if (icp) {
                      const operation = icp.operation || ""
                      return operation === "DEPOSIT" || operation === "WITHDRAW"
                    }
                    if (eth) {
                      const operation = eth.operation || ""
                      return operation === "DEPOSIT" || operation === "WITHDRAW"
                    }
                    if (btc) {
                      const operation = btc.operation || ""
                      return operation === "DEPOSIT" || operation === "WITHDRAW"
                    }
                    return false
                  })
                  .slice(0, 5)
                  .map((tx, i) => {
                  // Parse transaction data
                  const unwrapOpt = (opt: any) => Array.isArray(opt) && opt.length ? opt[0] : undefined
                  const icp = unwrapOpt(tx.icp_tx)
                  const eth = unwrapOpt(tx.eth_tx)
                  const btc = unwrapOpt(tx.btc_tx)
                  
                  let operation = "TRANSACTION"
                  let token = "-"
                  let amount = "-"
                  let description = tx.description || "Bridge transaction"
                  
                  if (icp) {
                    operation = icp.operation || "TRANSACTION"
                    token = icp.token || "-"
                    amount = icp.amount !== undefined ? `${(Number(icp.amount) / (token === "ckETH" ? 1e18 : 1e8)).toFixed(4)}` : "-"
                    description = `${operation} ${amount} ${token}`
                  } else if (eth) {
                    operation = eth.operation || "TRANSACTION"
                    token = eth.token || "-"
                    amount = eth.amount !== undefined ? `${(Number(eth.amount) / 1e18).toFixed(4)}` : "-"
                    description = `${operation} ${amount} ${token}`
                  } else if (btc) {
                    operation = btc.operation || "TRANSACTION"
                    token = btc.token || "-"
                    amount = btc.amount !== undefined ? `${(Number(btc.amount) / 1e8).toFixed(4)}` : "-"
                    description = `${operation} ${amount} ${token}`
                  }
                  
                  const timeStr = tx.timestamp ? new Date(Number(tx.timestamp) / 1000000).toLocaleString() : "Recent"
                  
                  const opClass = operation === "DEPOSIT"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : operation === "WITHDRAW"
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  
                  return (
                    <div key={i} className="flex items-start justify-between p-3 bg-slate-800/40 hover:bg-slate-800/60 rounded-lg transition-colors border border-slate-700/40">
                      <div className="flex-1 pr-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-[10px] rounded border ${opClass}`}>{operation}</span>
                          <span className="px-2 py-0.5 text-[10px] rounded border border-slate-600/50 text-slate-300 bg-slate-700/30">{token}</span>
                        </div>
                        <div className="text-white font-semibold text-sm">{amount} {token}</div>
                        <div className="text-slate-400 text-xs mt-1 break-all">{description}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-semibold text-xs">{tx.status || "PENDING"}</div>
                        <div className="text-slate-400 text-xs">{timeStr}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Token Selection Modal */}
        {showTokenModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-900 rounded-lg p-6 w-full max-w-md mx-4">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white text-lg font-semibold">Select a token</h3>
                <button 
                  onClick={() => setShowTokenModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Search Input */}
              <div className="relative mb-4">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input 
                  type="text" 
                  placeholder="Search name or canister ID"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Network Header */}
              <div className="text-slate-400 text-sm mb-3">All networks</div>

              {/* Token List */}
              <div className="max-h-80 overflow-y-auto">
                {tokens.map((token) => (
                  <div 
                    key={token.symbol}
                    onClick={() => handleTokenSelect(token.symbol)}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    {/* Token Icon */}
                    <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                      {token.symbol === "BTC" ? (
                        <span className="text-white text-sm font-bold">₿</span>
                      ) : token.symbol === "ETH" ? (
                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223 12.056 7.026 19.31 12.223 12.056 0z"/>
                        </svg>
                      ) : token.symbol === "ckBTC" ? (
                        <span className="text-white text-xs font-bold">₿IC</span>
                      ) : (
                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                      )}
                    </div>
                    
                    {/* Token Info */}
                    <div className="flex-1">
                      <div className="text-white font-medium">{token.symbol}</div>
                      <div className="text-slate-400 text-sm">{token.network}</div>
                    </div>
                    
                    {/* Balance Placeholder */}
                    <div className="text-slate-400 text-sm">--</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <Toaster />
      </div>
    </div>
  )
}


