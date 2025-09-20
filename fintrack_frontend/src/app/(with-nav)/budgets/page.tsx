"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, CalendarClock, CheckCircle, Coins, RefreshCw, ShieldCheck, Sparkles, Wallet } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/use-toast"
import { budgetService, type AssetKind, bitcoinService, ethereumService, balanceService, currencyService } from "@/services/backend"

function toNsFromDatetimeLocal(value: string): bigint {
  // value example: 2025-09-08T12:34
  const ms = new Date(value).getTime()
  return BigInt(ms) * BigInt(1_000_000)
}

function fromNsToDatetimeLocal(ns: bigint): string {
  const ms = Number(ns / BigInt(1_000_000))
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, "0")
  const dd = pad(d.getDate())
  const MM = pad(d.getMonth() + 1)
  const yyyy = d.getFullYear()
  const hh = pad(d.getHours())
  const mm = pad(d.getMinutes())
  return `${dd}/${MM}/${yyyy} ${hh}:${mm}`
}

function variantToString(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "object") {
    const keys = Object.keys(value)
    if (keys.length === 1) return keys[0]
    try { return JSON.stringify(value) } catch { return "[object]" }
  }
  return String(value)
}

function stringifySafe(value: any): string {
  try {
    return JSON.stringify(value, (_k, v) => typeof v === "bigint" ? v.toString() : v)
  } catch {
    return String(value)
  }
}

function toDecimalStringNat(amount: bigint | undefined, decimals: number): string {
  if (amount === undefined) return "0"
  const s = amount.toString()
  if (decimals === 0) return s
  const pad = decimals - s.length
  if (pad >= 0) {
    return `0.${"0".repeat(pad)}${s}`.replace(/\.0+$/, "")
  }
  const idx = s.length - decimals
  const intPart = s.slice(0, idx)
  const fracPart = s.slice(idx).replace(/0+$/, "")
  return fracPart.length ? `${intPart}.${fracPart}` : intPart
}
function parseDecimalToBaseUnits(input: string, decimals: number): bigint {
  const cleaned = (input || "").trim()
  if (cleaned === "") return BigInt(0)
  const parts = cleaned.split(".")
  const intPart = parts[0].replace(/[^0-9]/g, "") || "0"
  const fracRaw = (parts[1] || "").replace(/[^0-9]/g, "")
  const fracPart = (fracRaw + "0".repeat(decimals)).slice(0, decimals)
  const base = BigInt(10) ** BigInt(decimals)
  return BigInt(intPart || "0") * base + BigInt(fracPart || "0")
}


function formatUsd(n: number | undefined): string {
  if (!isFinite(n as number)) return "$0.00"
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n as number) } catch { return `$${(n as number).toFixed(2)}` }
}

function formatUsdPrecise(n: number | undefined): string {
  if (!isFinite(n as number)) return "$0.00"
  const val = n as number
  if (val > 0 && val < 0.01) {
    return `$${val.toFixed(6)}`
  }
  return formatUsd(val)
}

export default function BudgetsPage() {
  const { toast } = useToast()
  const [activeAssetTab, setActiveAssetTab] = useState<"BTC" | "ETH">("BTC")
  const [assetCanister, setAssetCanister] = useState<string>("")
  const [assetKind, setAssetKind] = useState<AssetKind>("CkBtc")
  const [name, setName] = useState<string>("")
  const [amountUsd, setAmountUsd] = useState<string>("")
  const [periodStart, setPeriodStart] = useState<string>("")
  const [periodEnd, setPeriodEnd] = useState<string>("")

  const [reqPreview, setReqPreview] = useState<{ allowance: bigint; estimated_fee: bigint; required_user_balance: bigint } | null>(null)
  const [budgets, setBudgets] = useState<any[]>([])
  const [events, setEvents] = useState<any[] | null>(null)
  const [eventsBudget, setEventsBudget] = useState<any | null>(null)
  const [livePreview, setLivePreview] = useState<boolean>(true)
  const [previewMap, setPreviewMap] = useState<Record<string, { projected_available: bigint; projected_unlocked: bigint }>>({})

  const [loadingPreview, setLoadingPreview] = useState(false)
  const [creating, setCreating] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState<number>(0)
  const pageSize = 2
  const [withdrawInput, setWithdrawInput] = useState<Record<string, string>>({})

  useEffect(() => {
    // Default canister IDs from env to help local dev
    if (activeAssetTab === "BTC") {
      setAssetKind("CkBtc")
      const ckbtc = process.env.NEXT_PUBLIC_CANISTER_ID_CKBTC_LEDGER || "mc6ru-gyaaa-aaaar-qaaaq-cai"
      setAssetCanister(ckbtc)
    } else {
      setAssetKind("CkEth")
      const cketh = process.env.NEXT_PUBLIC_CANISTER_ID_CKETH_LEDGER || "apia6-jaaaa-aaaar-qabma-cai"
      setAssetCanister(cketh)
    }
  }, [activeAssetTab])

  const decimals = useMemo(() => (assetKind === "CkBtc" ? 8 : 18), [assetKind])
  const symbol = useMemo(() => (assetKind === "CkBtc" ? "ckBTC" : "ckETH"), [assetKind])
  const [balances, setBalances] = useState<{ ckbtc?: bigint; cketh?: bigint }>({})
  const [rates, setRates] = useState<{ btc_to_usd: number; eth_to_usd: number } | null>(null)
  const [ledgerFee, setLedgerFee] = useState<bigint | null>(null)

  const amountBaseUnit: bigint = useMemo(() => {
    const usd = parseFloat(amountUsd || "0")
    if (!rates || !isFinite(usd) || usd <= 0) return BigInt(0)
    if (assetKind === "CkBtc") {
      const btc = usd / (rates.btc_to_usd || 1)
      const sats = Math.floor(btc * 1e8)
      return BigInt(Math.max(0, sats))
    } else {
      const eth = usd / (rates.eth_to_usd || 1)
      const gwei = Math.floor(eth * 1e9)
      return BigInt(Math.max(0, gwei)) * BigInt(1_000_000_000)
    }
  }, [amountUsd, rates, assetKind])

  async function loadBudgets() {
    if (!assetCanister) return
    setLoadingList(true)
    setError(null)
    const res = await budgetService.listByAsset(assetCanister)
    if (res.success) setBudgets(res.data)
    else setError(res.error)
    setLoadingList(false)
    setPage(0)
  }

  async function onPreviewRequirements() {
    setLoadingPreview(true)
    setError(null)
    setReqPreview(null)
    try {
      const res = await budgetService.previewRequirements(assetCanister, assetKind, amountBaseUnit)
      if (res.success) setReqPreview(res.data)
      else setError(res.error)
    } catch (e: any) {
      setError(e?.message || "Failed preview")
    } finally {
      setLoadingPreview(false)
    }
  }

  async function onApprove() {
    setError(null)
    try {
      // Ensure preview is done so we can get the fee
      if (!reqPreview) {
        await onPreviewRequirements()
      }
      const approveAmount = reqPreview
        ? BigInt(reqPreview.required_user_balance)
        : amountBaseUnit
      if (assetKind === "CkBtc") {
        const b = await (budgetService as any).approveForLockCkbtc(approveAmount)
        if (!b.success) {
          toast({
            title: "Error",
            description: b.error,
            variant: "destructive"
          })
          return
        }
      } else {
        const b = await (budgetService as any).approveForLockCketh(approveAmount)
        if (!b.success) {
          toast({
            title: "Error",
            description: b.error,
            variant: "destructive"
          })
          return
        }
      }
      toast({
        title: "Success!",
        description: "Approve successful.",
        variant: "success"
      })
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "Approve failed",
        variant: "destructive"
      })
    }
  }

  async function onCreate() {
    setCreating(true)
    setError(null)
    try {
      const startNs = toNsFromDatetimeLocal(periodStart)
      const endNs = toNsFromDatetimeLocal(periodEnd)
      const res = await budgetService.createAndLock({
        assetCanister,
        assetKind,
        name,
        amountToLock: amountBaseUnit,
        periodStartNs: startNs,
        periodEndNs: endNs,
      })
      if (!res.success) {
        toast({
          title: "Error",
          description: res.error,
          variant: "destructive"
        })
        return
      }
      toast({
        title: "Success!",
        description: "Budget created.",
        variant: "success"
      })
      await loadBudgets()
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "Failed to create budget",
        variant: "destructive"
      })
    } finally {
      setCreating(false)
    }
  }

  async function onPreviewAccrual(id: string) {
    setWorkingId(id)
    setError(null)
    const r = await budgetService.previewAccrual(id)
    if (!r.success) {
      toast({
        title: "Error",
        description: r.error,
        variant: "destructive"
      })
    } else {
      toast({
        title: "Info",
        description: `Accrual: available=${String(r.data.projected_available)}, unlocked_so_far=${String(r.data.projected_unlocked)}`,
        variant: "info"
      })
    }
    setWorkingId(null)
  }

  async function onRefreshStep(id: string) {
    setWorkingId(id)
    setError(null)
    const r = await budgetService.refreshAccrualStep(id)
    if (!r.success) {
      toast({
        title: "Error",
        description: r.error,
        variant: "destructive"
      })
    } else {
      toast({
        title: "Success!",
        description: "Accrual di-refresh.",
        variant: "success"
      })
    }
    setWorkingId(null)
    await loadBudgets()
  }

  async function onWithdraw(id: string, max: bigint) {
    setWorkingId(id)
    setError(null)
    const r = await budgetService.withdraw(id, max)
    if (!r.success) {
      toast({
        title: "Error",
        description: r.error,
        variant: "destructive"
      })
    } else {
      toast({
        title: "Success!",
        description: `Withdraw tx height: ${r.data}`,
        variant: "success"
      })
    }
    setWorkingId(null)
    await loadBudgets()
  }

  async function onWithdrawFlow(b: any) {
    setError(null)
    try {
      // If completed period, ensure accrual is fully persisted
      const current = await budgetService.get(b.id)
      if (current.success && current.data && current.data.status && current.data.status.Completed !== undefined) {
        const r = await budgetService.refreshAccrualStep(b.id)
        if (!r.success) return setError(r.error)
      }
      // Always preview to get latest available without mutating
      const p = await budgetService.previewAccrual(b.id)
      if (!p.success) return setError(p.error)
      const available = BigInt(p.data.projected_available || 0)
      if (available <= BigInt(0)) {
        return setError("No balance available for withdrawal.")
      }
      // If user typed custom amount, use it; else withdraw all available
      const typed = withdrawInput[b.id]
      let amount = typed && typed.trim() !== "" ? BigInt(typed.replace(/[^0-9]/g, "")) : available
      if (amount > available) return setError("Amount melebihi available.")
      await onWithdraw(b.id, amount)
    } catch (e: any) {
      setError(e?.message || "Withdraw failed")
    }
  }

  async function onViewEvents(id: string) {
    setWorkingId(id)
    setError(null)
    const r = await budgetService.listEvents(id, 50, 0)
    if (!r.success) setError(r.error)
    else {
      setEvents(r.data)
      const ctx = budgets.find((x)=>x.id===id) || null
      setEventsBudget(ctx)
    }
    setWorkingId(null)
  }

  useEffect(() => {
    loadBudgets()
    loadBalancesAndRates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetCanister])

  useEffect(() => {
    async function loadFee() {
      if (!assetCanister) return setLedgerFee(null)
      const f = await budgetService.getLedgerFee(assetCanister, assetKind)
      setLedgerFee(f.success ? (f.data as bigint) : null)
    }
    loadFee()
  }, [assetCanister, assetKind])

  async function loadBalancesAndRates() {
    try {
      const [b, r] = await Promise.all([
        balanceService.getPortfolioSummary(),
        currencyService.getCurrencyRates(),
      ])
      if (b.success) setBalances({ ckbtc: BigInt(b.data.ckbtc_balance), cketh: BigInt(b.data.cketh_balance) })
      if (r.success) setRates({ btc_to_usd: r.data.btc_to_usd, eth_to_usd: r.data.eth_to_usd })
    } catch {}
  }

  useEffect(() => {
    let timer: any
    const tick = async () => {
      try {
        const entries: [string, { projected_available: bigint; projected_unlocked: bigint }][] = []
        for (const b of budgets) {
          const r = await budgetService.previewAccrual(b.id)
          if (r.success) entries.push([b.id, { projected_available: r.data.projected_available as bigint, projected_unlocked: r.data.projected_unlocked as bigint }])
        }
        if (entries.length) {
          setPreviewMap(Object.fromEntries(entries))
        }
      } catch {}
    }
    tick()
    timer = setInterval(tick, 2000)
    return () => timer && clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-900">
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Budgets</h1>
            <p className="text-gray-300 mt-1">Linear vesting using ckAssets</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
              <h3 className="font-semibold text-white text-lg mb-4">Choose Asset</h3>
              <Tabs defaultValue={activeAssetTab} onValueChange={(v) => setActiveAssetTab(v as any)}>
                <TabsList className="grid w-full grid-cols-2 bg-slate-800/50">
                  <TabsTrigger value="BTC" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:glow-purple">BTC</TabsTrigger>
                  <TabsTrigger value="ETH" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:glow-purple">ETH</TabsTrigger>
                </TabsList>
                <TabsContent value="BTC" className="mt-4 text-slate-300 text-sm">Use ckBTC ledger</TabsContent>
                <TabsContent value="ETH" className="mt-4 text-slate-300 text-sm">Use ckETH ledger</TabsContent>
              </Tabs>
              {/* Balances summary */}
              <div className="mt-4">
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="text-slate-400 text-xs">
                    {activeAssetTab === "BTC" ? "ckBTC Balance" : "ckETH Balance"}
                  </div>
                  <div className="text-white font-mono text-sm">
                    {activeAssetTab === "BTC" 
                      ? `${toDecimalStringNat(balances.ckbtc ?? BigInt(0), 8)} ckBTC`
                      : `${toDecimalStringNat(balances.cketh ?? BigInt(0), 18)} ckETH`
                    }
                  </div>
                  <div className="text-slate-500 text-xs">
                    {rates ? formatUsd(activeAssetTab === "BTC" 
                      ? (Number(balances.ckbtc ?? BigInt(0)) / 1e8) * (rates.btc_to_usd || 0)
                      : (Number(balances.cketh ?? BigInt(0)) / 1e18) * (rates.eth_to_usd || 0)
                    ) : ""}
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <Label className="text-slate-300">Ledger Canister ID</Label>
                <Input value={assetCanister} onChange={(e) => setAssetCanister(e.target.value)} className="bg-slate-800/50 border-slate-600 text-white font-mono text-xs" />
              </div>
            </Card>

            <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
              <h3 className="font-semibold text-white text-lg mb-4">Create Budget</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-300">Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Example: Monthly" className="bg-slate-800/50 border-slate-600 text-white mt-2" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Amount (USD)</Label>
                    <Input value={amountUsd} onChange={(e) => setAmountUsd(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="e.g. 100.00" className="bg-slate-800/50 border-slate-600 text-white mt-2" />
                    <div className="text-xs text-slate-400 mt-1">Will be converted to {symbol} base unit (decimals {decimals})</div>
                    <div className="text-xs text-slate-500 mt-1">Preview: <span className="font-mono text-slate-300">{toDecimalStringNat(amountBaseUnit, decimals)} {symbol}</span>
                      <span className="ml-2">{rates ? (
                        assetKind === "CkBtc"
                          ? formatUsdPrecise((Number(amountBaseUnit)/1e8) * (rates.btc_to_usd||0))
                          : formatUsdPrecise((Number(amountBaseUnit)/1e18) * (rates.eth_to_usd||0))
                      ) : ""}</span>
                    </div>
                  </div>
                  <div></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Start</Label>
                    <Input type="datetime-local" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="bg-slate-800/50 border-slate-600 text-white mt-2" />
                  </div>
                  <div>
                    <Label className="text-slate-300">End</Label>
                    <Input type="datetime-local" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="bg-slate-800/50 border-slate-600 text-white mt-2" />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button onClick={onPreviewRequirements} disabled={loadingPreview || !assetCanister || !amountBaseUnit} className="bg-purple-600 hover:bg-purple-700 glow-purple">
                    {loadingPreview ? (<><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Preview...</>) : (<><Sparkles className="h-4 w-4 mr-2" />Preview Allowance & Fee</>)}
                  </Button>
                  <Button onClick={onApprove} disabled={!amountBaseUnit} className="bg-emerald-600 hover:bg-emerald-700">
                    <ShieldCheck className="h-4 w-4 mr-2" />Approve ICRC-2
                  </Button>
                  <Button onClick={onCreate} disabled={creating || !name || !amountBaseUnit || !periodStart || !periodEnd || !assetCanister} className="bg-indigo-600 hover:bg-indigo-700">
                    {creating ? (<><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Creating...</>) : (<><Coins className="h-4 w-4 mr-2" />Create & Lock</>)}
                  </Button>
                </div>

                {reqPreview && (
                  <div className="mt-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700 text-xs text-slate-300">
                    <div className="flex flex-col md:flex-row md:items-center md:gap-6 gap-1">
                      <div>
                        <span className="text-slate-400">Allowance diperlukan:</span> <span className="text-white font-mono">{toDecimalStringNat(BigInt(reqPreview.allowance), decimals)} {symbol}</span>
                        <span className="ml-2 text-slate-500">{rates ? (
                          assetKind === "CkBtc"
                            ? `(${formatUsdPrecise((Number(reqPreview.allowance)/1e8) * (rates.btc_to_usd||0))})`
                            : `(${formatUsdPrecise((Number(reqPreview.allowance)/1e18) * (rates.eth_to_usd||0))})`
                        ) : ""}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Estimasi fee:</span> <span className="text-white font-mono">{toDecimalStringNat(BigInt(reqPreview.estimated_fee), decimals)} {symbol}</span>
                        <span className="ml-2 text-slate-500">{rates ? (
                          assetKind === "CkBtc"
                            ? `(${formatUsdPrecise((Number(reqPreview.estimated_fee)/1e8) * (rates.btc_to_usd||0))})`
                            : `(${formatUsdPrecise((Number(reqPreview.estimated_fee)/1e18) * (rates.eth_to_usd||0))})`
                        ) : ""}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Total balance required:</span> <span className="text-white font-mono">{toDecimalStringNat(BigInt(reqPreview.required_user_balance), decimals)} {symbol}</span>
                        <span className="ml-2 text-slate-500">{rates ? (
                          assetKind === "CkBtc"
                            ? `(${formatUsdPrecise((Number(reqPreview.required_user_balance)/1e8) * (rates.btc_to_usd||0))})`
                            : `(${formatUsdPrecise((Number(reqPreview.required_user_balance)/1e18) * (rates.eth_to_usd||0))})`
                        ) : ""}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white text-lg">Budget List</h3>
                <Button onClick={loadBudgets} disabled={loadingList} className="bg-purple-600 hover:bg-purple-700 glow-purple">
                  {loadingList ? (<><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Loading</>) : (<><RefreshCw className="h-4 w-4 mr-2" />Refresh</>)}
                </Button>
              </div>
              <div className="space-y-3">
                {budgets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="h-16 w-16 text-purple-400 mb-6 flex items-center justify-center">
                      <ShieldCheck className="h-16 w-16" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-3">No Budgets Yet</h3>
                    <p className="text-slate-300 text-center mb-6 max-w-md">
                      Create your first budget to start managing your financial goals with linear vesting.
                    </p>
                  </div>
                ) : (
                  <>
                    {budgets.slice(page * pageSize, page * pageSize + pageSize).map((b) => (
                  <div key={b.id} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <div className="text-white font-semibold">{b.name} <span className="text-xs text-slate-400">({variantToString(b.status)})</span></div>
                        {/* budget id hidden for compact UI */}
                        <div className="text-xs text-slate-400">
                          locked: <span className="font-mono">{toDecimalStringNat(BigInt(b.locked_balance), Number(b.decimals))}</span>
                          <span className="ml-2 text-slate-500">{rates ? `(${formatUsd((() => { if (b.decimals === 8) { const btc = Number(b.locked_balance)/1e8; return btc * (rates.btc_to_usd||0) } else { const eth = Number(b.locked_balance)/1e18; return eth * (rates.eth_to_usd||0) }})())})` : ""}</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          {(() => {
                            const avail = previewMap[b.id]?.projected_available !== undefined ? BigInt(previewMap[b.id].projected_available) : BigInt(b.available_to_withdraw)
                            const dec = Number(b.decimals)
                            const usd = rates ? (dec === 8 ? (Number(avail)/1e8) * (rates.btc_to_usd||0) : (Number(avail)/1e18) * (rates.eth_to_usd||0)) : undefined
                            return (<>
                              available: <span className="font-mono">{toDecimalStringNat(avail, dec)}</span>
                              <span className="ml-2 text-slate-500">{usd!==undefined? `(${formatUsd(usd)})` : ""}</span>
                            </>)
                          })()}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-1"><CalendarClock className="h-3 w-3" /> {fromNsToDatetimeLocal(BigInt(b.period_start_ns))} → {fromNsToDatetimeLocal(BigInt(b.period_end_ns))}</div>
                      </div>
                      <div className="col-span-2 mb-2">
                        {previewMap[b.id] && (
                          <div className="w-full h-1.5 bg-slate-800/60 rounded-full overflow-hidden border border-slate-700">
                            {(() => {
                              const unlocked = Number(previewMap[b.id].projected_unlocked || 0)
                              const total = Number(b.period_locked || 0)
                              const pct = total > 0 ? Math.min(100, Math.max(0, Math.floor((unlocked / total) * 100))) : 0
                              return <div className="h-full bg-gradient-to-r from-purple-600 to-cyan-500" style={{ width: pct + "%" }} />
                            })()}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 md:items-end">
                        <div className="bg-slate-800/40 border border-slate-700 rounded-md px-2 py-2 flex flex-col gap-2 w-full">
                          <div className="text-[10px] text-slate-400">amount ({symbol})</div>
                          <Input
                            value={(withdrawInput[b.id] ? toDecimalStringNat(BigInt(withdrawInput[b.id]), Number(b.decimals)) : "")}
                            onChange={(e)=>{
                              const val = e.target.value
                              // save as base units, but input human-readable
                              const base = parseDecimalToBaseUnits(val, Number(b.decimals))
                              setWithdrawInput(v=>({ ...v, [b.id]: base.toString() }))
                            }}
                            placeholder={previewMap[b.id] ? toDecimalStringNat(BigInt(previewMap[b.id].projected_available), Number(b.decimals)) : "0"}
                            className="h-8 px-2 text-xs w-full bg-slate-900/50 border-slate-700 font-mono"
                          />
                          <div className="flex gap-1">
                            {([25,50,100] as const).map(p=> (
                              <Button key={p} size="sm" className="h-7 px-2 text-xs bg-slate-700 hover:bg-slate-600" onClick={()=>{
                                const liveAvail = previewMap[b.id]?.projected_available as any
                                const avail = liveAvail !== undefined ? BigInt(liveAvail) : BigInt(b.available_to_withdraw || 0)
                                const amt = (avail * BigInt(p)) / BigInt(100)
                                setWithdrawInput(v=>({ ...v, [b.id]: amt.toString() }))
                              }}>{p}%</Button>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 justify-start md:justify-end">
                          <Button size="sm" onClick={() => onRefreshStep(b.id)} disabled={workingId === b.id} className="h-7 px-2 text-xs bg-indigo-600 hover:bg-indigo-700"><RefreshCw className="h-3.5 w-3.5 mr-1" />Refresh</Button>
                          <Button size="sm" onClick={() => onWithdrawFlow(b)} disabled={workingId === b.id} className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700"><Wallet className="h-3.5 w-3.5 mr-1" />Withdraw</Button>
                          <Button size="sm" onClick={() => onViewEvents(b.id)} disabled={workingId === b.id} className="h-7 px-2 text-xs bg-purple-600 hover:bg-purple-700">Events</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                    ))}
                  </>
                )}
              </div>
              {budgets.length > pageSize && (
                <div className="flex items-center justify-end gap-2 mt-3">
                  <Button size="sm" className="h-7 px-2 text-xs bg-slate-700 hover:bg-slate-600" disabled={page===0} onClick={()=>setPage((p)=>Math.max(0,p-1))}>Prev</Button>
                  <div className="text-xs text-slate-400">Page {page+1} / {Math.ceil(budgets.length/pageSize)}</div>
                  <Button size="sm" className="h-7 px-2 text-xs bg-slate-700 hover:bg-slate-600" disabled={(page+1)>=Math.ceil(budgets.length/pageSize)} onClick={()=>setPage((p)=>p+1)}>Next</Button>
                </div>
              )}
            </Card>

            {events && (
              <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white text-lg">Events</h3>
                  <Button size="sm" onClick={() => { setEvents(null); setEventsBudget(null) }} className="bg-slate-700 hover:bg-slate-600">Close</Button>
                </div>
                <div className="space-y-2 text-sm">
                  {events.length === 0 && <div className="text-slate-400">No events</div>}
                  {events.map((e, idx) => {
                    const dec = Number(eventsBudget?.decimals ?? (assetKind === "CkBtc" ? 8 : 18))
                    const sym = eventsBudget ? (eventsBudget.decimals === 8 ? "ckBTC" : "ckETH") : symbol
                    const amtOpt = e.amount
                    const rawAmt = Array.isArray(amtOpt) && amtOpt.length ? BigInt(amtOpt[0]) : null
                    const hrAmt = rawAmt !== null ? `${toDecimalStringNat(rawAmt, dec)} ${sym}` : "-"
                    const usd = rates && rawAmt !== null
                      ? (dec === 8 ? (Number(rawAmt)/1e8) * (rates.btc_to_usd||0) : (Number(rawAmt)/1e18) * (rates.eth_to_usd||0))
                      : undefined
                    return (
                      <div key={idx} className="p-3 bg-slate-800/50 rounded border border-slate-700">
                        <div className="text-white font-medium flex items-center justify-between">
                          <span>{variantToString(e.kind)}</span>
                          <span className="text-xs text-slate-400">{fromNsToDatetimeLocal(BigInt(e.at_time_ns))}</span>
                        </div>
                        <div className="text-slate-300 text-xs mt-1">Amount: <span className="font-mono text-white">{hrAmt}</span>{usd!==undefined? <span className="ml-2 text-slate-500">({formatUsdPrecise(usd)})</span> : null}</div>
                        {e.note && Array.isArray(e.note) && e.note.length ? (
                          <div className="text-slate-500 text-xs mt-1">Note: <span className="font-mono">{String(e.note[0])}</span></div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center"><AlertTriangle className="h-4 w-4 mr-2" />{error}</div>
        )}
      </div>
      <Toaster />
    </div>
  )
}


