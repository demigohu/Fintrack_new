"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/use-toast"
import { CheckCircle, AlertTriangle, Target, Plus, TrendingUp, Calendar, DollarSign } from "lucide-react"
import { goalsService, balanceService, currencyService, budgetService } from "@/services/backend"
import { formatUsd, formatUsdPrecise, toDecimalStringNat, toDecimalStringBigInt, parseDecimalToBaseUnits } from "@/lib/utils"
import { Principal } from "@dfinity/principal"

// Helper function to check goal status based on time and target
const getGoalStatus = (goal: GoalInfo): { status: string; isExpired: boolean; isCompleted: boolean } => {
  const now = Date.now() * 1_000_000 // Convert to nanoseconds
  const isExpired = now >= Number(goal.end_ns)
  const isTargetReached = goal.locked_balance >= goal.amount_to_lock
  
  if (isExpired) {
    if (isTargetReached) {
      return { status: 'Completed', isExpired: true, isCompleted: true }
    } else {
      return { status: 'Failed', isExpired: true, isCompleted: false }
    }
  } else if (isTargetReached) {
    return { status: 'Completed', isExpired: false, isCompleted: true }
  } else {
    return { status: 'Active', isExpired: false, isCompleted: false }
  }
}

type GoalInfo = {
  id: string
  name: string
  amount_to_lock: bigint
  locked_balance: bigint
  available_to_withdraw: bigint
  status: { Active?: null; Completed?: null; Failed?: null; Archived?: null }
  start_ns: bigint
  end_ns: bigint
  created_at_ns: bigint
  updated_at_ns: bigint
  asset_canister: Principal
  decimals: number
}

type GoalProgress = {
  goal_id: string
  target_amount: { 0: string }
  current_locked: { 0: string }
  progress_percentage: number
  is_target_reached: boolean
}

type GoalEvent = {
  at_time_ns: string
  kind: { InitialLock?: null; AddFunds?: null; Withdraw?: null; CliffUnlocked?: null; TargetReached?: null; Failed?: null }
  amount?: { 0: string }
  note?: string
}

const CKBTC_LEDGER = "mc6ru-gyaaa-aaaar-qaaaq-cai"
const CKETH_LEDGER = "apia6-jaaaa-aaaar-qabma-cai"

export default function GoalsPage() {
  const { toast } = useToast()
  const [goals, setGoals] = useState<GoalInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rates, setRates] = useState<{ btc_to_usd: number; eth_to_usd: number } | null>(null)
  const [balances, setBalances] = useState<{ ckbtc_balance: { 0: string }; cketh_balance: { 0: string } } | null>(null)
  const [activeTab, setActiveTab] = useState<"CkBtc" | "CkEth">("CkBtc")
  const [selectedGoal, setSelectedGoal] = useState<GoalInfo | null>(null)
  const [goalProgress, setGoalProgress] = useState<GoalProgress | null>(null)
  const [goalEvents, setGoalEvents] = useState<GoalEvent[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showAddFundsForm, setShowAddFundsForm] = useState(false)
  const [showWithdrawForm, setShowWithdrawForm] = useState(false)
  const [showEvents, setShowEvents] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)

  // Form states
  const [createForm, setCreateForm] = useState({
    name: "",
    amountUsd: "",
    periodStart: "",
    periodEnd: "",
    initialAmount: "",
    assetType: "CkBtc" as "CkBtc" | "CkEth"
  })
  const [addFundsForm, setAddFundsForm] = useState({
    amount: ""
  })
  const [withdrawForm, setWithdrawForm] = useState({
    amount: ""
  })
  const [addFundsLoading, setAddFundsLoading] = useState(false)
  const [withdrawLoading, setWithdrawLoading] = useState(false)

  const currentLedger = activeTab === "CkBtc" ? CKBTC_LEDGER : CKETH_LEDGER
  const currentDecimals = activeTab === "CkBtc" ? 8 : 18
  const currentRate = activeTab === "CkBtc" ? rates?.btc_to_usd || 0 : rates?.eth_to_usd || 0
  const currentBalance = activeTab === "CkBtc" ? balances?.ckbtc_balance : balances?.cketh_balance

  useEffect(() => {
    loadData(true) // Show loading for data
  }, [])

  const loadData = async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true)
      }
      
      const [goalsRes, ratesRes, balancesRes] = await Promise.all([
        goalsService.list(),
        currencyService.getCurrencyRates(),
        balanceService.getPortfolioSummary()
      ])

      if (goalsRes.success) {
        setGoals(goalsRes.data)
        
        // Refresh all goals to unlock expired funds
        for (const goal of goalsRes.data) {
          try {
            await goalsService.refresh(goal.id)
          } catch (err) {
            console.log('Failed to refresh goal:', goal.id, err)
          }
        }
        
        // Reload goals after refresh
        const refreshedGoalsResult = await goalsService.list()
        if (refreshedGoalsResult.success) {
          setGoals(refreshedGoalsResult.data)
        }
      } else {
        setError(goalsRes.error)
      }

      if (ratesRes.success) {
        setRates(ratesRes.data)
      }

      if (balancesRes.success) {
        setBalances(balancesRes.data)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  const toNsFromDatetimeLocal = (datetimeLocal: string) => {
    return BigInt(new Date(datetimeLocal).getTime() * 1_000_000)
  }

  const fromNsToDatetimeLocal = (ns: string) => {
    const ms = Number(BigInt(ns) / BigInt(1_000_000))
    return new Date(ms).toISOString().slice(0, 16)
  }

  const variantToString = (variant: any) => {
    if (typeof variant === 'object' && variant !== null) {
      const keys = Object.keys(variant)
      if (keys.length === 1) {
        return keys[0]
      }
    }
    return 'Unknown'
  }

  const stringifySafe = (obj: any) => {
    return JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  }


  const handlePreviewCreate = async () => {
    if (!createForm.name || !createForm.amountUsd || !createForm.periodStart || !createForm.periodEnd) {
      toast({
        title: "Error",
        description: "Please fill all required fields",
        variant: "destructive"
      })
      return
    }

    try {
      const selectedAssetType = createForm.assetType
      const selectedLedger = selectedAssetType === "CkBtc" ? CKBTC_LEDGER : CKETH_LEDGER
      const selectedDecimals = selectedAssetType === "CkBtc" ? 8 : 18
      const selectedRate = selectedAssetType === "CkBtc" ? (rates?.btc_to_usd || 0) : (rates?.eth_to_usd || 0)

      if (selectedRate <= 0) {
        toast({
          title: "Error",
          description: "Currency rate not available. Please try again later.",
          variant: "destructive"
        })
        return
      }

      const amountUsd = parseFloat(createForm.amountUsd)
      const amountBaseUnits = parseDecimalToBaseUnits((amountUsd / selectedRate).toFixed(selectedDecimals), selectedDecimals)
      
      console.log('Create form initialAmount:', createForm.initialAmount)
      console.log('Create form initialAmount type:', typeof createForm.initialAmount)
      console.log('Selected decimals:', selectedDecimals)
      
      const initialAmount = createForm.initialAmount ? 
        parseDecimalToBaseUnits(createForm.initialAmount, selectedDecimals) : undefined
      
      console.log('Parsed initialAmount:', initialAmount)
      console.log('InitialAmount BigInt value:', initialAmount?.toString())

      // Get fee for preview
      const feeResult = await budgetService.getLedgerFee(selectedLedger, selectedAssetType)
      if (!feeResult.success) {
        toast({
          title: "Error",
          description: `Failed to get fee: ${feeResult.error}`,
          variant: "destructive"
        })
        return
      }

      const preview = {
        name: createForm.name,
        assetType: selectedAssetType,
        targetAmount: amountBaseUnits,
        targetAmountUsd: amountUsd,
        initialAmount: initialAmount || BigInt(0),
        initialAmountUsd: initialAmount ? parseFloat(createForm.initialAmount) : 0,
        fee: feeResult.data,
        periodStart: createForm.periodStart,
        periodEnd: createForm.periodEnd,
        totalApproval: initialAmount ? initialAmount + feeResult.data : BigInt(0)
      }

      setPreviewData(preview)
      setShowPreviewModal(true)
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      })
    }
  }

  const handleCreateGoal = async () => {
    try {
      if (!createForm.name || !createForm.amountUsd || !createForm.periodStart || !createForm.periodEnd) {
        toast({
          title: "Error",
          description: "Please fill all required fields",
          variant: "destructive"
        })
        return
      }

      setActionLoading(true)

      const selectedAssetType = createForm.assetType
      const selectedLedger = selectedAssetType === "CkBtc" ? CKBTC_LEDGER : CKETH_LEDGER
      const selectedDecimals = selectedAssetType === "CkBtc" ? 8 : 18
      const selectedRate = selectedAssetType === "CkBtc" ? (rates?.btc_to_usd || 0) : (rates?.eth_to_usd || 0)

      if (selectedRate <= 0) {
        toast({
          title: "Error",
          description: "Currency rate not available. Please try again later.",
          variant: "destructive"
        })
        return
      }

      const amountUsd = parseFloat(createForm.amountUsd)
      const amountBaseUnits = parseDecimalToBaseUnits((amountUsd / selectedRate).toFixed(selectedDecimals), selectedDecimals)
      const initialAmount = createForm.initialAmount ? 
        parseDecimalToBaseUnits(createForm.initialAmount, selectedDecimals) : undefined

      // If there's an initial amount, approve first
      if (initialAmount && initialAmount > BigInt(0)) {
        toast({
          title: "Info",
          description: "Approving initial amount...",
          variant: "info"
        })
        
        // Get ledger fee for approval
        const feeResult = await budgetService.getLedgerFee(selectedLedger, selectedAssetType)
        if (!feeResult.success) {
          toast({
            title: "Error",
            description: `Failed to get fee: ${feeResult.error}`,
            variant: "destructive"
          })
          return
        }
        
        const totalApproval = initialAmount + feeResult.data
        const approveResult = selectedAssetType === "CkBtc" 
          ? await goalsService.approveForAddFundsCkbtc(totalApproval)
          : await goalsService.approveForAddFundsCketh(totalApproval)
        
        if (!approveResult.success) {
          toast({
            title: "Error",
            description: `Approval failed: ${approveResult.error}`,
            variant: "destructive"
          })
          return
        }
        
        toast({
          title: "Info",
          description: "Approval successful! Creating goal...",
          variant: "info"
        })
      }

      const result = await goalsService.createAndLock({
        assetCanister: selectedLedger,
        assetKind: selectedAssetType,
        name: createForm.name,
        amountToLock: amountBaseUnits,
        startNs: toNsFromDatetimeLocal(createForm.periodStart),
        endNs: toNsFromDatetimeLocal(createForm.periodEnd),
        initialAmount
      })

      if (result.success) {
        toast({
          title: "Success!",
          description: "Goal created successfully!",
          variant: "success"
        })
        setCreateForm({ name: "", amountUsd: "", periodStart: "", periodEnd: "", initialAmount: "", assetType: "CkBtc" })
        setShowCreateForm(false)
        setShowPreviewModal(false)
        loadData(false) // No loading spinner for refresh
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handlePreviewAddFunds = async () => {
    if (!selectedGoal) {
      toast({
        title: "Error",
        description: "No goal selected",
        variant: "destructive"
      })
      return
    }

    if (!addFundsForm.amount || addFundsForm.amount === '') {
      toast({
        title: "Error",
        description: "Please enter an amount",
        variant: "destructive"
      })
      return
    }

    try {
      console.log('Selected goal for add funds:', selectedGoal)
      
      // Handle case where selectedGoal might be an array
      const goal = Array.isArray(selectedGoal) ? selectedGoal[0] : selectedGoal
      if (!goal) {
        toast({
          title: "Error",
          description: "Invalid goal data",
          variant: "destructive"
        })
        return
      }
      
      console.log('Processed goal:', goal)
      console.log('Asset canister:', goal.asset_canister)
      console.log('Asset canister type:', typeof goal.asset_canister)
      
      // Extract asset canister ID from Principal
      const assetCanisterId = goal.asset_canister.toText()
      
      console.log('Processed asset canister ID:', assetCanisterId)
      
      const goalAssetType = assetCanisterId === CKBTC_LEDGER ? "CkBtc" : "CkEth"
      const goalDecimals = goalAssetType === "CkBtc" ? 8 : 18
      const amount = parseDecimalToBaseUnits(addFundsForm.amount, goalDecimals)
      
      // Get fee for preview
      const feeResult = await budgetService.getLedgerFee(assetCanisterId, goalAssetType)
      if (!feeResult.success) {
        toast({
          title: "Error",
          description: `Failed to get fee: ${feeResult.error}`,
          variant: "destructive"
        })
        return
      }

      const currentRate = goalAssetType === "CkBtc" ? (rates?.btc_to_usd || 0) : (rates?.eth_to_usd || 0)
      const amountUsd = parseFloat(addFundsForm.amount) * currentRate

      const preview = {
        goalName: goal.name,
        assetType: goalAssetType,
        amount: amount,
        amountUsd: amountUsd,
        fee: feeResult.data,
        totalApproval: amount + feeResult.data,
        decimals: goalDecimals
      }

      console.log('Preview data:', preview)
      setPreviewData(preview)
      setShowPreviewModal(true)
    } catch (err: any) {
      console.error('Error in handlePreviewAddFunds:', err)
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      })
    }
  }

  const handleAddFunds = async () => {
    if (!selectedGoal) return

    try {
      setActionLoading(true)
      setAddFundsLoading(true)
      if (!addFundsForm.amount || addFundsForm.amount === '') {
        toast({
          title: "Error",
          description: "Please enter an amount",
          variant: "destructive"
        })
        return
      }

      // Handle case where selectedGoal might be an array
      const goal = Array.isArray(selectedGoal) ? selectedGoal[0] : selectedGoal
      if (!goal) {
        toast({
          title: "Error",
          description: "Invalid goal data",
          variant: "destructive"
        })
        return
      }

      // Extract asset canister ID from Principal
      const assetCanisterId = goal.asset_canister.toText()
      
      // Determine asset type from selected goal
      const goalAssetType = assetCanisterId === CKBTC_LEDGER ? "CkBtc" : "CkEth"
      const goalDecimals = goalAssetType === "CkBtc" ? 8 : 18
      
      const amount = parseDecimalToBaseUnits(addFundsForm.amount, goalDecimals)
      
      // Get ledger fee for approval
      const feeResult = await budgetService.getLedgerFee(assetCanisterId, goalAssetType)
      if (!feeResult.success) {
        toast({
          title: "Error",
          description: `Failed to get fee: ${feeResult.error}`,
          variant: "destructive"
        })
        return
      }
      
      const totalApproval = amount + feeResult.data
      
      // Approve first (amount + fee)
      toast({
        title: "Info",
        description: "Approving funds...",
        variant: "info"
      })
      const approveResult = goalAssetType === "CkBtc" 
        ? await goalsService.approveForAddFundsCkbtc(totalApproval)
        : await goalsService.approveForAddFundsCketh(totalApproval)

      if (!approveResult.success) {
        toast({
          title: "Error",
          description: `Approve failed: ${approveResult.error}`,
          variant: "destructive"
        })
        return
      }

      // Add funds
      toast({
        title: "Info",
        description: "Adding funds to goal...",
        variant: "info"
      })
      const result = await goalsService.addFunds(goal.id, amount)
      if (result.success) {
        console.log('Add funds result:', result.data)
        toast({
          title: "Success!",
          description: "Funds added successfully!",
          variant: "success"
        })
        setAddFundsForm({ amount: "" })
        setShowAddFundsForm(false)
        setShowPreviewModal(false)
        await loadData(false) // No loading spinner for refresh
        await loadGoalDetails(goal.id)
        console.log('Data reloaded after add funds')
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setActionLoading(false)
      setAddFundsLoading(false)
    }
  }

  const handleWithdraw = async () => {
    if (!selectedGoal) return

    try {
      setWithdrawLoading(true)
      // Ensure selectedGoal is a single object, not an array
      const goal = Array.isArray(selectedGoal) ? selectedGoal[0] : selectedGoal
      if (!goal) {
        toast({
          title: "Error",
          description: "No goal selected",
          variant: "destructive"
        })
        return
      }

      console.log('Selected goal for withdraw:', goal)
      console.log('Asset canister for withdraw:', goal.asset_canister)
      console.log('Withdraw form amount:', withdrawForm.amount)
      
      if (!withdrawForm.amount || withdrawForm.amount === '') {
        toast({
          title: "Error",
          description: "Please enter an amount",
          variant: "destructive"
        })
        return
      }

      // Validate goal and asset_canister
      if (!goal.asset_canister) {
        toast({
          title: "Error",
          description: "Invalid goal asset information",
          variant: "destructive"
        })
        return
      }

      // Determine asset type from selected goal
      const goalAssetType = goal.asset_canister.toText() === CKBTC_LEDGER ? "CkBtc" : "CkEth"
      const goalDecimals = goalAssetType === "CkBtc" ? 8 : 18

      const amount = parseDecimalToBaseUnits(withdrawForm.amount, goalDecimals)
      const result = await goalsService.withdraw(goal.id, amount)
      if (result.success) {
        toast({
          title: "Success!",
          description: "Withdrawal successful!",
          variant: "success"
        })
        setWithdrawForm({ amount: "" })
        setShowWithdrawForm(false)
        loadData(false) // No loading spinner for refresh
        loadGoalDetails(selectedGoal.id)
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setWithdrawLoading(false)
    }
  }

  const loadGoalDetails = async (goalId: string) => {
    try {
      const [goalRes, progressRes, eventsRes] = await Promise.all([
        goalsService.get(goalId),
        goalsService.getProgress(goalId),
        goalsService.listEvents(goalId, 10, 0)
      ])

      if (goalRes.success) setSelectedGoal(goalRes.data)
      if (progressRes.success) setGoalProgress(progressRes.data)
      if (eventsRes.success) setGoalEvents(eventsRes.data)
    } catch (err: any) {
      console.error('Failed to load goal details:', err)
    }
  }

  const filteredGoals = goals.filter(goal => {
    const goalCanisterId = goal.asset_canister.toString()
    const assetKind = goalCanisterId === CKBTC_LEDGER ? "CkBtc" : "CkEth"
    return assetKind === activeTab
  })


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-900">
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Goals</h1>
            <p className="text-gray-300 mt-1">Save for your financial goals with periodic contributions</p>
          </div>
          <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Create Goal
          </Button>
        </div>


      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-800 border border-red-200 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Balance Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {activeTab} Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
              <span className="text-slate-300">Loading balance...</span>
            </div>
          ) : (
            <>
              <div className="text-2xl font-bold">
                {currentBalance ? toDecimalStringNat({ 0: currentBalance.toString() }, currentDecimals) : "0"} {activeTab}
              </div>
              <div className="text-sm text-gray-600">
                {currentBalance ? formatUsd(toDecimalStringNat({ 0: currentBalance.toString() }, currentDecimals), currentRate) : "$0.00"}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "CkBtc" | "CkEth")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="CkBtc">ckBTC Goals</TabsTrigger>
          <TabsTrigger value="CkEth">ckETH Goals</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-6">
          {loading ? (
            <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Target className="h-16 w-16 text-purple-400 mb-6" />
                <h3 className="text-xl font-semibold text-white mb-3">Loading Goals...</h3>
                <p className="text-slate-300 text-center mb-6 max-w-md">
                  Please wait while we load your goals data.
                </p>
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
                  <span className="text-slate-300">Loading...</span>
                </div>
              </CardContent>
            </Card>
          ) : filteredGoals.length === 0 ? (
            <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Target className="h-16 w-16 text-purple-400 mb-6" />
                <h3 className="text-xl font-semibold text-white mb-3">No Goals Yet</h3>
                <p className="text-slate-300 text-center mb-6 max-w-md">
                  Create your first savings goal to start building your financial future.
                </p>
                <Button onClick={() => setShowCreateForm(true)} size="lg" className="bg-purple-600 hover:bg-purple-700">
                  Create Your First Goal
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {filteredGoals.map((goal) => (
                <Card key={goal.id} className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple hover:shadow-lg transition-all duration-200">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-white">
                          {goal.name}
                          <Badge variant={
                            (() => {
                              const { status } = getGoalStatus(goal)
                              return status === 'Active' ? 'default' :
                                     status === 'Completed' ? 'secondary' :
                                     'destructive'
                            })()
                          }>
                            {(() => {
                              const { status } = getGoalStatus(goal)
                              return status
                            })()}
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          Created {new Date(Number(goal.created_at_ns) / 1_000_000).toLocaleDateString()}
                          {(() => {
                            const { isExpired, isCompleted } = getGoalStatus(goal)
                            if (isExpired && !isCompleted) {
                              return (
                                <span className="text-red-500 font-medium">
                                  {" "}• Expired {new Date(Number(goal.end_ns) / 1_000_000).toLocaleDateString()}
                                </span>
                              )
                            }
                            return null
                          })()}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={(() => {
                            const { isExpired, isCompleted } = getGoalStatus(goal)
                            return isExpired || isCompleted
                          })()}
                          onClick={() => {
                            setSelectedGoal(goal)
                            loadGoalDetails(goal.id)
                            setShowAddFundsForm(true)
                          }}
                        >
                          Add Funds
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedGoal(goal)
                            loadGoalDetails(goal.id)
                            setShowWithdrawForm(true)
                          }}
                        >
                          Withdraw
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedGoal(goal)
                            loadGoalDetails(goal.id)
                            setShowEvents(true)
                          }}
                        >
                          Events
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Target Amount</Label>
                        <div className="text-lg font-semibold">
                          {toDecimalStringBigInt(goal.amount_to_lock || BigInt(0), currentDecimals)} {activeTab}
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatUsd(toDecimalStringBigInt(goal.amount_to_lock || BigInt(0), currentDecimals), currentRate)}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Current Balance</Label>
                        <div className="text-lg font-semibold">
                          {toDecimalStringBigInt(goal.locked_balance || BigInt(0), currentDecimals)} {activeTab}
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatUsd(toDecimalStringBigInt(goal.locked_balance || BigInt(0), currentDecimals), currentRate)}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Available</Label>
                        <div className="text-lg font-semibold">
                          {toDecimalStringBigInt(goal.available_to_withdraw || BigInt(0), currentDecimals)} {activeTab}
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatUsd(toDecimalStringBigInt(goal.available_to_withdraw || BigInt(0), currentDecimals), currentRate)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                        <span>Progress</span>
                        <span>
                          {goal.amount_to_lock && goal.amount_to_lock > BigInt(0) 
                            ? Math.round((Number(goal.locked_balance || BigInt(0)) / Number(goal.amount_to_lock)) * 100)
                            : 0}%
                        </span>
                      </div>
                      <Progress 
                        value={goal.amount_to_lock && goal.amount_to_lock > BigInt(0) 
                          ? (Number(goal.locked_balance || BigInt(0)) / Number(goal.amount_to_lock)) * 100
                          : 0} 
                        className="h-2"
                      />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-gray-600">Start Date</Label>
                        <div>{new Date(Number(goal.start_ns) / 1_000_000).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <Label className="text-gray-600">End Date</Label>
                        <div>{new Date(Number(goal.end_ns) / 1_000_000).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Goal Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Create New Goal</CardTitle>
              <CardDescription>Set a savings target and timeline</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Goal Name</Label>
                <Input
                  id="name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g., Buy a Laptop"
                />
              </div>
              <div>
                <Label htmlFor="assetType">Asset Type</Label>
                <select
                  id="assetType"
                  value={createForm.assetType}
                  onChange={(e) => setCreateForm({ ...createForm, assetType: e.target.value as "CkBtc" | "CkEth" })}
                  className="w-full p-2 border border-gray-300 rounded-md bg-white text-black"
                >
                  <option value="CkBtc">ckBTC</option>
                  <option value="CkEth">ckETH</option>
                </select>
              </div>
              <div>
                <Label htmlFor="amountUsd">Target Amount (USD)</Label>
                <Input
                  id="amountUsd"
                  type="number"
                  step="0.01"
                  value={createForm.amountUsd}
                  onChange={(e) => setCreateForm({ ...createForm, amountUsd: e.target.value })}
                  placeholder="1000.00"
                />
              </div>
              <div>
                <Label htmlFor="initialAmount">Initial Amount (Optional)</Label>
                <Input
                  id="initialAmount"
                  type="number"
                  step="0.00000001"
                  value={createForm.initialAmount}
                  onChange={(e) => setCreateForm({ ...createForm, initialAmount: e.target.value })}
                  placeholder="0.1"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Amount in {activeTab} to transfer immediately
                </p>
              </div>
              <div>
                <Label htmlFor="periodStart">Start Date</Label>
                <Input
                  id="periodStart"
                  type="datetime-local"
                  value={createForm.periodStart}
                  onChange={(e) => setCreateForm({ ...createForm, periodStart: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="periodEnd">End Date</Label>
                <Input
                  id="periodEnd"
                  type="datetime-local"
                  value={createForm.periodEnd}
                  onChange={(e) => setCreateForm({ ...createForm, periodEnd: e.target.value })}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handlePreviewCreate} className="flex-1">
                  Preview & Create
                </Button>
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Funds Modal */}
      {showAddFundsForm && selectedGoal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Add Funds to Goal</CardTitle>
              <CardDescription>{selectedGoal.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="addAmount">Amount ({activeTab})</Label>
                <Input
                  id="addAmount"
                  type="number"
                  step="0.00000001"
                  value={addFundsForm.amount}
                  onChange={(e) => setAddFundsForm({ amount: e.target.value })}
                  placeholder="0.1"
                />
                <p className="text-xs text-gray-600 mt-1">
                  {addFundsForm.amount && currentRate > 0 && 
                    formatUsd(addFundsForm.amount, currentRate)
                  }
                </p>
              </div>
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handlePreviewAddFunds} 
                  className="flex-1"
                  disabled={addFundsLoading}
                >
                  {addFundsLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    "Preview & Add"
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowAddFundsForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawForm && selectedGoal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Withdraw from Goal</CardTitle>
              <CardDescription>{selectedGoal.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="withdrawAmount">Amount ({(() => {
                  const goal = Array.isArray(selectedGoal) ? selectedGoal[0] : selectedGoal
                  return goal?.asset_canister?.toText() === CKBTC_LEDGER ? "CkBtc" : "CkEth"
                })()})</Label>
                <div className="space-y-2">
                  <Input
                    id="withdrawAmount"
                    type="number"
                    step="0.00000001"
                    value={withdrawForm.amount}
                    onChange={(e) => setWithdrawForm({ amount: e.target.value })}
                    placeholder="0.1"
                  />
                  <div className="grid grid-cols-4 gap-2">
                    {[25, 50, 75, 100].map((percentage) => (
                      <Button
                        key={percentage}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const goal = Array.isArray(selectedGoal) ? selectedGoal[0] : selectedGoal
                          console.log('Percentage button clicked:', percentage)
                          console.log('Goal:', goal)
                          console.log('Available to withdraw:', goal?.available_to_withdraw)
                          
                          if (goal && goal.available_to_withdraw) {
                            const decimals = goal.asset_canister?.toText() === CKBTC_LEDGER ? 8 : 18
                            const availableAmount = Number(toDecimalStringBigInt(goal.available_to_withdraw, decimals))
                            const percentageAmount = (availableAmount * percentage) / 100
                            const finalAmount = percentageAmount.toFixed(decimals)
                            
                            console.log('Available amount:', availableAmount)
                            console.log('Percentage amount:', percentageAmount)
                            console.log('Final amount:', finalAmount)
                            
                            setWithdrawForm({ amount: finalAmount })
                          } else {
                            console.log('No goal or no available balance')
                          }
                        }}
                        className="text-xs"
                      >
                        {percentage}%
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600">
                    Available: {toDecimalStringBigInt(selectedGoal.available_to_withdraw || BigInt(0), selectedGoal.asset_canister?.toText() === CKBTC_LEDGER ? 8 : 18)} {selectedGoal.asset_canister?.toText() === CKBTC_LEDGER ? "ckBTC" : "ckETH"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleWithdraw} 
                  className="flex-1"
                  disabled={withdrawLoading}
                >
                  {withdrawLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    "Withdraw"
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowWithdrawForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Events Modal */}
      {showEvents && selectedGoal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden mx-auto">
            <CardHeader>
              <CardTitle>Goal Events</CardTitle>
              <CardDescription>{selectedGoal.name}</CardDescription>
            </CardHeader>
            <CardContent className="overflow-y-auto">
              {goalEvents.length === 0 ? (
                <p className="text-gray-600 text-center py-4">No events yet</p>
              ) : (
                <div className="space-y-3">
                  {goalEvents.map((event, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {variantToString(event.kind)}
                          </Badge>
                          <span className="text-sm text-gray-600">
                            {new Date(Number(event.at_time_ns) / 1_000_000).toLocaleString()}
                          </span>
                        </div>
                        {event.amount && (
                          <div className="text-sm font-medium">
                            {toDecimalStringNat(event.amount || { 0: "0" }, currentDecimals)} {activeTab}
                          </div>
                        )}
                      </div>
                      {event.note && (
                        <p className="text-sm text-gray-600 mt-1">{event.note}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end pt-4">
                <Button variant="outline" onClick={() => setShowEvents(false)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && previewData && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>
                {previewData.goalName ? "Preview Add Funds" : "Preview Goal Creation"}
              </CardTitle>
              <CardDescription>
                {previewData.goalName ? "Review details before adding funds" : "Review details before creating your goal"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {previewData.goalName ? (
                  // Add Funds Preview
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Goal:</span>
                      <span className="text-sm">{previewData.goalName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Asset:</span>
                      <span className="text-sm">{previewData.assetType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Amount to Add:</span>
                      <span className="text-sm">
                        {toDecimalStringBigInt(previewData.amount, previewData.decimals)} {previewData.assetType}
                        <br />
                        <span className="text-xs text-gray-500">${previewData.amountUsd.toFixed(2)} USD</span>
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Approval Required:</span>
                      <span className="text-sm">
                        {toDecimalStringBigInt(previewData.totalApproval, previewData.decimals)} {previewData.assetType}
                        <br />
                        <span className="text-xs text-gray-500">(Amount + Fee)</span>
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Ledger Fee:</span>
                      <span className="text-sm">
                        {toDecimalStringBigInt(previewData.fee, previewData.decimals)} {previewData.assetType}
                        <br />
                        <span className="text-xs text-gray-500">${formatUsdPrecise(toDecimalStringBigInt(previewData.fee, previewData.decimals), previewData.assetType === "CkBtc" ? (rates?.btc_to_usd || 0) : (rates?.eth_to_usd || 0))} USD</span>
                      </span>
                    </div>
                  </>
                ) : (
                  // Create Goal Preview
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Goal Name:</span>
                      <span className="text-sm">{previewData.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Asset:</span>
                      <span className="text-sm">{previewData.assetType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Target Amount:</span>
                      <span className="text-sm">
                        {toDecimalStringBigInt(previewData.targetAmount, previewData.assetType === "CkBtc" ? 8 : 18)} {previewData.assetType}
                        <br />
                        <span className="text-xs text-gray-500">${previewData.targetAmountUsd.toFixed(2)} USD</span>
                      </span>
                    </div>
                    {previewData.initialAmount > 0 && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">Initial Amount:</span>
                          <span className="text-sm">
                            {toDecimalStringBigInt(previewData.initialAmount, previewData.assetType === "CkBtc" ? 8 : 18)} {previewData.assetType}
                            <br />
                            <span className="text-xs text-gray-500">${previewData.initialAmountUsd.toFixed(2)} USD</span>
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">Approval Required:</span>
                          <span className="text-sm">
                            {toDecimalStringBigInt(previewData.totalApproval, previewData.assetType === "CkBtc" ? 8 : 18)} {previewData.assetType}
                            <br />
                            <span className="text-xs text-gray-500">(Initial + Fee)</span>
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">Ledger Fee:</span>
                          <span className="text-sm">
                            {toDecimalStringBigInt(previewData.fee, previewData.assetType === "CkBtc" ? 8 : 18)} {previewData.assetType}
                            <br />
                            <span className="text-xs text-gray-500">${formatUsdPrecise(toDecimalStringBigInt(previewData.fee, previewData.assetType === "CkBtc" ? 8 : 18), previewData.assetType === "CkBtc" ? (rates?.btc_to_usd || 0) : (rates?.eth_to_usd || 0))} USD</span>
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Period:</span>
                      <span className="text-sm">
                        {new Date(previewData.periodStart).toLocaleDateString()} - {new Date(previewData.periodEnd).toLocaleDateString()}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={previewData.goalName ? handleAddFunds : handleCreateGoal} 
                  className="flex-1"
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Loading...
                    </div>
                  ) : (
                    previewData.goalName
                      ? "Approve & Add Funds"
                      : (previewData.initialAmount > 0 ? "Approve & Create" : "Create Goal")
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowPreviewModal(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      </div>
      <Toaster />
    </div>
  )
}
