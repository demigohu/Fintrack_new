"use client"

import { useEffect, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { History, Search, RefreshCw } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { transactionService } from "@/services/backend"

type ChainTab = "ALL" | "Bitcoin" | "Ethereum" | "ICP"

export default function TransactionsPage() {
  const { isLoggedIn } = useAuth()
  const [chain, setChain] = useState<ChainTab>("ALL")
  const [search, setSearch] = useState("")
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

  const filtered = items.filter((t) => {
    if (chain !== "ALL" && t.id?.chain !== chain) return false
    if (search && !JSON.stringify(t).toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className="lg:col-span-2">
              <Label className="text-slate-300">Cari</Label>
              <div className="flex items-center gap-2">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="tx hash, alamat, dsb" className="bg-slate-800/50 border-slate-600 text-white" />
                <Button variant="outline" className="border-slate-600 text-slate-300">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-slate-300">Chain</Label>
              <Tabs value={chain} onValueChange={(v) => setChain(v as ChainTab)}>
                <TabsList className="grid grid-cols-4 bg-slate-800/50">
                  {["ALL","Bitcoin","Ethereum","ICP"].map(v => (
                    <TabsTrigger key={v} value={v} className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:glow-purple">
                      {v}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {["ALL","Bitcoin","Ethereum","ICP"].map(v => (
                  <TabsContent key={v} value={v} />
                ))}
              </Tabs>
            </div>
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

            {filtered.map((tx, i) => (
              <div key={i} className="flex items-center justify-between p-3 hover:bg-slate-800/50 rounded-lg transition-colors">
                <div>
                  <div className="text-white font-semibold text-sm">{tx.id?.chain || "Unknown"}</div>
                  <div className="text-slate-400 text-xs break-all">{tx.id?.tx_hash}</div>
                </div>
                <div className="text-right">
                  <div className="text-white font-semibold text-sm">{tx.status}</div>
                  <div className="text-slate-400 text-xs">{String(tx.id?.timestamp || "")}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}


