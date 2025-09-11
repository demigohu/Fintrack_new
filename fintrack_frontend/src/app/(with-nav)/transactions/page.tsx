"use client"

import { useEffect, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { History, RefreshCw, Coins, Bitcoin, Zap } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { transactionService } from "@/services/backend"

export default function TransactionsPage() {
  const { isLoggedIn } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ckAssetItems, setCkAssetItems] = useState<any[]>([])
  const [ethereumItems, setEthereumItems] = useState<any[]>([])
  const [bitcoinItems, setBitcoinItems] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState("icp")

  const loadAll = useCallback(async () => {
    if (!isLoggedIn) return
    setLoading(true)
    setError(null)
    const res = await transactionService.getTransactions()
    if (res.success) {
      const items = res.data
      const unwrapOpt = (opt: any) => Array.isArray(opt) && opt.length ? opt[0] : undefined
      setCkAssetItems(items.filter((tx: any) => unwrapOpt(tx.icp_tx)))
      setEthereumItems(items.filter((tx: any) => unwrapOpt(tx.eth_tx)))
      setBitcoinItems(items.filter((tx: any) => unwrapOpt(tx.btc_tx)))
    } else {
      setError(res.error)
    }
    setLoading(false)
  }, [isLoggedIn])

  useEffect(() => { void loadAll() }, [loadAll])

  const formatNsToLocal = (ns: bigint | number | undefined) => {
    if (ns === undefined || ns === null) return ""
    try {
      if (typeof ns === "bigint") {
        const ms = Number(ns / BigInt(1000000))
        return new Date(ms).toLocaleString()
      }
      const ms = Math.floor(Number(ns) / 1_000_000)
      return new Date(ms).toLocaleString()
    } catch {
      return String(ns)
    }
  }

  const formatTokenAmount = (value: unknown, token: string): string => {
    try {
      const v = typeof value === "bigint" ? value : BigInt(String(value ?? 0))
      const decimals = token === "ckETH" ? 18 : 8
      const amount = Number(v) / (decimals === 18 ? 1e18 : 1e8)
      return amount.toFixed(4)
    } catch {
      return String(value ?? "-")
    }
  }

  const renderIcpTransactions = () => (
    <div className="space-y-2">
      {!isLoggedIn && (<div className="text-slate-400 text-sm">Please login first.</div>)}
      {error && (<div className="text-red-400 text-sm">{error}</div>)}
      {loading && (<div className="text-slate-400 text-sm">Loading...</div>)}
      {!loading && ckAssetItems.length === 0 && (<div className="text-slate-400 text-sm">No ckAsset transactions found.</div>)}

      {ckAssetItems.map((tx, i) => {
        const unwrapOpt = <T,>(opt: any): T | undefined => (Array.isArray(opt) && opt.length ? opt[0] as T : undefined)
        const icp = unwrapOpt<any>(tx?.icp_tx)

        const timeStr = formatNsToLocal(tx?.id?.timestamp)
        const operation = icp?.operation || "-"
        const token = icp?.token || "-"
        const amount = icp?.amount !== undefined ? formatTokenAmount(icp.amount, token) : "-"
        const description = tx?.description || `${operation} ${amount} ${token}`
        const chainLabel = tx?.id?.chain || "Unknown"

        const opClass = operation === "DEPOSIT"
          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
          : operation === "WITHDRAW"
          ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
          : "bg-amber-500/20 text-amber-300 border-amber-500/30"

        return (
          <div key={i} className="flex items-start justify-between p-4 bg-slate-800/40 hover:bg-slate-800/60 rounded-lg transition-colors border border-slate-700/40">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 text-[11px] rounded border ${opClass}`}>{operation}</span>
                <span className="px-2 py-0.5 text-[11px] rounded border border-slate-600/50 text-slate-300 bg-slate-700/30">{token}</span>
                <span className="px-2 py-0.5 text-[11px] rounded border border-slate-600/50 text-slate-400 bg-slate-700/20">{chainLabel}</span>
              </div>
              <div className="text-white font-semibold">{amount} {token}</div>
              {description && (<div className="text-slate-400 text-xs mt-1 break-all">{description}</div>)}
            </div>
            <div className="text-right">
              <div className="text-white font-semibold text-sm">{tx.status}</div>
              <div className="text-slate-400 text-xs">{timeStr}</div>
            </div>
          </div>
        )
      })}
    </div>
  )

  const formatWeiToEth = (wei: unknown): string => {
    try {
      const v = typeof wei === "bigint" ? wei : BigInt(String(wei ?? 0))
      const s = v.toString().padStart(19, "0")
      const head = s.slice(0, s.length - 18) || "0"
      const tail = s.slice(s.length - 18).replace(/0+$/, "")
      return tail ? `${head}.${tail}` : head
    } catch {
      return String(wei ?? "-")
    }
  }

  const renderEthereumTransactions = () => (
    <div className="space-y-2">
      {!isLoggedIn && (<div className="text-slate-400 text-sm">Please login first.</div>)}
      {!loading && ethereumItems.length === 0 && (<div className="text-slate-400 text-sm">No native Ethereum transactions found.</div>)}

      {ethereumItems.map((tx) => {
        const unwrapOpt = (opt: any) => Array.isArray(opt) && opt.length ? opt[0] : undefined
        const eth = unwrapOpt(tx.eth_tx)
        const timeStr = formatNsToLocal(tx?.id?.timestamp)
        
        // Get operation from eth_tx for display
        const operation = eth?.operation || "UNKNOWN"
        const displayOperation = operation === "NATIVE_TRANSFER_IN" ? "DEPOSIT" 
                               : operation === "NATIVE_TRANSFER_OUT" ? "WITHDRAW"
                               : operation
        
        const statusLabel = tx.status || "UNKNOWN"
        const amountEth = eth ? formatWeiToEth(eth.amount) : "-"
        const txHash = eth?.tx_hash || tx?.id?.tx_hash
        const addr = eth?.address

        const opClass = displayOperation === "DEPOSIT"
          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
          : displayOperation === "WITHDRAW"
          ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
          : "bg-amber-500/20 text-amber-300 border-amber-500/30"

        return (
          <div key={txHash} className="flex items-start justify-between p-4 bg-slate-800/40 hover:bg-slate-800/60 rounded-lg transition-colors border border-slate-700/40">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 text-[11px] rounded border ${opClass}`}>{displayOperation}</span>
                <span className="px-2 py-0.5 text-[11px] rounded border border-slate-600/50 text-slate-300 bg-slate-700/30">ETH</span>
                <span className="px-2 py-0.5 text-[11px] rounded border border-slate-600/50 text-slate-400 bg-slate-700/20">Native</span>
              </div>
              <div className="text-white font-semibold">{amountEth} ETH</div>
              <div className="text-slate-400 text-xs mt-1 break-all">
                Hash: {txHash}
              </div>
              {addr && (
                <div className="text-slate-400 text-xs mt-1 break-all">
                  Address: {addr}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-white font-semibold text-sm">{statusLabel}</div>
              <div className="text-slate-400 text-xs">{timeStr}</div>
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderBitcoinTransactions = () => (
    <div className="space-y-2">
      {!isLoggedIn && (<div className="text-slate-400 text-sm">Please login first.</div>)}
      {bitcoinItems.length === 0 && (
        <div className="text-slate-400 text-sm">No native Bitcoin transactions found (Regtest not yet integrated).</div>
      )}

      {bitcoinItems.map((tx) => {
        const unwrapOpt = (opt: any) => Array.isArray(opt) && opt.length ? opt[0] : undefined
        const btc = unwrapOpt(tx.btc_tx)
        const timeStr = formatNsToLocal(tx?.id?.timestamp)
        // Get operation from btc_tx for display
        const operation = btc?.operation || "UNKNOWN"
        const displayOperation = operation === "NATIVE_TRANSFER_IN" ? "DEPOSIT" 
                               : operation === "NATIVE_TRANSFER_OUT" ? "WITHDRAW"
                               : operation
        
        const statusLabel = btc && typeof btc.confirmations === "number" && btc.confirmations > 0 ? "CONFIRMED" : "PENDING"
        const amountBtc = btc ? String((Number(btc.amount || 0) / 1e8).toFixed(4)) : "-"

        const opClass = displayOperation === "DEPOSIT"
          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
          : displayOperation === "WITHDRAW"
          ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
          : "bg-amber-500/20 text-amber-300 border-amber-500/30"

        return (
          <div key={tx?.id?.tx_hash} className="flex items-start justify-between p-4 bg-slate-800/40 hover:bg-slate-800/60 rounded-lg transition-colors border border-slate-700/40">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 text-[11px] rounded border ${opClass}`}>{displayOperation}</span>
                <span className="px-2 py-0.5 text-[11px] rounded border border-slate-600/50 text-slate-300 bg-slate-700/30">BTC</span>
                <span className="px-2 py-0.5 text-[11px] rounded border border-slate-600/50 text-slate-400 bg-slate-700/20">Native</span>
              </div>
              <div className="text-white font-semibold">{amountBtc} BTC</div>
              <div className="text-slate-400 text-xs mt-1 break-all">Hash: {tx?.id?.tx_hash}</div>
            </div>
            <div className="text-right">
              <div className="text-white font-semibold text-sm">{statusLabel}</div>
              <div className="text-slate-400 text-xs">{timeStr}</div>
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-900">
      <div className="p-8 mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold text-white mb-2">Transaction History</h1>
            <p className="text-slate-400">View ckAsset (ICP) and native (Ethereum, Bitcoin) transactions</p>
          </div>
          <Button onClick={() => { void loadAll() }} disabled={loading} className="bg-purple-600 hover:bg-purple-700 glow-purple">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>

        <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 w-full bg-slate-800/50 mb-4">
              <TabsTrigger value="icp" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:glow-purple">
                <Coins className="h-4 w-4 mr-2" /> ICP (ckBTC/ckETH)
              </TabsTrigger>
              <TabsTrigger value="ethereum" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:glow-purple">
                <Zap className="h-4 w-4 mr-2" /> Ethereum
              </TabsTrigger>
              <TabsTrigger value="bitcoin" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:glow-purple">
                <Bitcoin className="h-4 w-4 mr-2" /> Bitcoin
              </TabsTrigger>
            </TabsList>

            <TabsContent value="icp">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <History className="h-5 w-5 text-purple-400" />
                  <h3 className="font-heading font-semibold text-white text-lg">ICP (ckBTC/ckETH)</h3>
                </div>
              </div>
              {renderIcpTransactions()}
            </TabsContent>

            <TabsContent value="ethereum">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Zap className="h-5 w-5 text-purple-400" />
                  <h3 className="font-heading font-semibold text-white text-lg">Ethereum (Native)</h3>
                </div>
              </div>
              {renderEthereumTransactions()}
            </TabsContent>

            <TabsContent value="bitcoin">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Bitcoin className="h-5 w-5 text-purple-400" />
                  <h3 className="font-heading font-semibold text-white text-lg">Bitcoin (Native)</h3>
                </div>
              </div>
              {renderBitcoinTransactions()}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}


