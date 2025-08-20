"use client"

import { useEffect, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { History, RefreshCw } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { transactionService } from "@/services/backend"

// Chain tabs removed: show a single combined list

export default function TransactionsPage() {
  const { isLoggedIn } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<any[]>([])

  const load = useCallback(async () => {
    if (!isLoggedIn) return
    setLoading(true)
    setError(null)
    const res = await transactionService.getTransactions()
    if (res.success) setItems(res.data)
    else setError(res.error)
    setLoading(false)
  }, [isLoggedIn])

  useEffect(() => { void load() }, [load])

  const filtered = items

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
      const s = v.toString()
      if (decimals <= 0) return s
      if (s.length <= decimals) return `0.${"0".repeat(decimals - s.length)}${s}`.replace(/\.?0+$/, "")
      const head = s.slice(0, s.length - decimals)
      const tail = s.slice(s.length - decimals).replace(/0+$/, "")
      return tail ? `${head}.${tail}` : head
    } catch {
      return String(value ?? "-")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-900">
      <div className="p-8 mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold text-white mb-2">Riwayat Transaksi</h1>
            <p className="text-slate-400">Lihat semua transaksi on-chain Anda</p>
          </div>
          <Button onClick={() => void load()} disabled={loading} className="bg-purple-600 hover:bg-purple-700 glow-purple">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>

        <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <History className="h-5 w-5 text-purple-400" />
              <h3 className="font-heading font-semibold text-white text-lg">Semua Transaksi</h3>
            </div>
          </div>

          {/* Controls: hanya tombol refresh */}
          <div className="mb-4 -mt-2">
            <p className="text-slate-400 text-sm">Riwayat aktivitas on-chain (ckBTC/ckETH) dari index canister.</p>
          </div>

          <div className="space-y-2">
            {!isLoggedIn && (
              <div className="text-slate-400 text-sm">Silakan login terlebih dulu.</div>
            )}
            {error && (
              <div className="text-red-400 text-sm">{error}</div>
            )}
            {loading && (
              <div className="text-slate-400 text-sm">Memuat...</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="text-slate-400 text-sm">Tidak ada transaksi.</div>
            )}

            {filtered.map((tx, i) => {
              // Unwrap candid opt values ([] | [T])
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
                    {description && (
                      <div className="text-slate-400 text-xs mt-1 break-all">{description}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-white font-semibold text-sm">{tx.status}</div>
                    <div className="text-slate-400 text-xs">{timeStr}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}


