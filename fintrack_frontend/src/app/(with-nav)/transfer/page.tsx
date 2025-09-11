"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, CheckCircle, Send } from "lucide-react"
import { bitcoinService, ethereumService } from "@/services/backend"
import { useAuth } from "@/contexts/AuthContext"

export default function TransferPage() {
  const { isLoggedIn } = useAuth()

  // BTC state
  const [btcTo, setBtcTo] = useState("")
  const [btcAmount, setBtcAmount] = useState("") // in BTC
  const [btcSubmitting, setBtcSubmitting] = useState(false)
  const [btcTxId, setBtcTxId] = useState<string | null>(null)
  const [btcError, setBtcError] = useState<string | null>(null)

  // ETH state
  const [ethTo, setEthTo] = useState("")
  const [ethAmount, setEthAmount] = useState("") // in ETH
  const [ethSubmitting, setEthSubmitting] = useState(false)
  const [ethTxHash, setEthTxHash] = useState<string | null>(null)
  const [ethError, setEthError] = useState<string | null>(null)

  // Fee preview state
  const [btcFeePreview, setBtcFeePreview] = useState<any>(null)
  const [ethFeePreview, setEthFeePreview] = useState<any>(null)
  const [btcFeeLoading, setBtcFeeLoading] = useState(false)
  const [ethFeeLoading, setEthFeeLoading] = useState(false)

  // Preview BTC fee
  const previewBtcFee = async () => {
    if (!btcTo || !btcAmount) return
    setBtcFeeLoading(true)
    try {
      const sats = BigInt(Math.round(parseFloat(btcAmount || "0") * 1e8))
      const res = await bitcoinService.previewBtcFee(btcTo, sats)
      if (res.success) setBtcFeePreview(res.data)
      else setBtcFeePreview(null)
    } catch (e) {
      setBtcFeePreview(null)
    } finally {
      setBtcFeeLoading(false)
    }
  }

  // Preview ETH fee
  const previewEthFee = async () => {
    if (!ethTo || !ethAmount) return
    setEthFeeLoading(true)
    try {
      const wei = BigInt(Math.round(parseFloat(ethAmount || "0") * 1e18))
      const res = await ethereumService.previewEthFee(ethTo, wei)
      if (res.success) setEthFeePreview(res.data)
      else setEthFeePreview(null)
    } catch (e) {
      setEthFeePreview(null)
    } finally {
      setEthFeeLoading(false)
    }
  }

  const submitBtc = async () => {
    setBtcSubmitting(true)
    setBtcTxId(null)
    setBtcError(null)
    try {
      // convert BTC to satoshis
      const sats = BigInt(Math.round(parseFloat(btcAmount || "0") * 1e8))
      const res = await bitcoinService.transferNativeBtc(btcTo, sats)
      if (res.success) setBtcTxId(res.data)
      else setBtcError(res.error)
    } catch (e: any) {
      setBtcError(e?.message || "Failed to transfer BTC")
    } finally {
      setBtcSubmitting(false)
    }
  }

  const submitEth = async () => {
    setEthSubmitting(true)
    setEthTxHash(null)
    setEthError(null)
    try {
      // convert ETH to wei
      const wei = BigInt(Math.round(parseFloat(ethAmount || "0") * 1e18))
      const res = await ethereumService.transferNativeEth(ethTo, wei)
      if (res.success) setEthTxHash(res.data)
      else setEthError(res.error)
    } catch (e: any) {
      setEthError(e?.message || "Failed to transfer ETH")
    } finally {
      setEthSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-900">
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-white mb-2">Transfer Crypto (Native)</h1>
          <p className="text-slate-400">Send native BTC and ETH directly from your canister wallet</p>
        </div>

        {!isLoggedIn && (
          <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
            <div className="text-slate-400">Please login first</div>
          </Card>
        )}

        {isLoggedIn && (
          <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
            <Tabs defaultValue="btc">
              <TabsList className="grid grid-cols-2 w-full bg-slate-800/50">
                <TabsTrigger value="btc" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:glow-purple">BTC</TabsTrigger>
                <TabsTrigger value="eth" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:glow-purple">ETH</TabsTrigger>
              </TabsList>

              {/* BTC */}
              <TabsContent value="btc" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-slate-300">Destination (BTC native address)</Label>
                    <Input
                      value={btcTo}
                      onChange={(e) => setBtcTo(e.target.value)}
                      placeholder="bcrt1... (Regtest) / bc1... (Mainnet)"
                      className="bg-slate-800/50 border-slate-600 text-white mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Amount (BTC)</Label>
                    <Input
                      value={btcAmount}
                      onChange={(e) => setBtcAmount(e.target.value)}
                      placeholder="e.g., 0.001"
                      className="bg-slate-800/50 border-slate-600 text-white mt-2"
                    />
                  </div>

                  {/* BTC Fee Preview */}
                  {btcTo && btcAmount && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Button 
                          onClick={previewBtcFee} 
                          disabled={btcFeeLoading}
                          variant="outline" 
                          size="sm"
                          className="border-purple-500/30 text-purple-300 hover:bg-purple-500/20"
                        >
                          {btcFeeLoading ? "Calculating..." : "Preview Fee"}
                        </Button>
                      </div>
                      
                      {btcFeePreview && (
                        <div className="p-4 bg-slate-800/30 border border-slate-600/30 rounded-lg space-y-2">
                          <h4 className="text-sm font-medium text-purple-300">Fee Preview</h4>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="text-slate-400">Estimated Fee:</div>
                            <div className="text-white">{btcFeePreview.estimatedFeeSats / 100_000_000} BTC</div>
                            
                            <div className="text-slate-400">Fee Rate:</div>
                            <div className="text-white">{btcFeePreview.feeRateSatsPerVb} sat/vB</div>
                            
                            <div className="text-slate-400">Tx Size:</div>
                            <div className="text-white">{btcFeePreview.estimatedTxSizeVb} vB</div>
                            
                            <div className="text-slate-400">Speed:</div>
                            <div className="text-white capitalize">{btcFeePreview.confirmationTimeEstimate}</div>
                            
                            <div className="text-slate-400">Total (with fee):</div>
                            <div className="text-white">{btcFeePreview.totalAmountWithFee / 100_000_000} BTC</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-400">Fee will be estimated automatically</div>
                    <Button onClick={submitBtc} disabled={btcSubmitting || !btcTo || !btcAmount} className="bg-purple-600 hover:bg-purple-700 glow-purple">
                      {btcSubmitting ? (<><Send className="h-4 w-4 mr-2 animate-spin" />Sending...</>) : (<><Send className="h-4 w-4 mr-2" />Send BTC</>)}
                    </Button>
                  </div>

                  {btcTxId && (
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-300 text-sm flex items-center">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Transaction ID: {btcTxId}
                    </div>
                  )}
                  {btcError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      {btcError}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ETH */}
              <TabsContent value="eth" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-slate-300">Destination (ETH native address)</Label>
                    <Input
                      value={ethTo}
                      onChange={(e) => setEthTo(e.target.value)}
                      placeholder="0x..."
                      className="bg-slate-800/50 border-slate-600 text-white mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Amount (ETH)</Label>
                    <Input
                      value={ethAmount}
                      onChange={(e) => setEthAmount(e.target.value)}
                      placeholder="e.g., 0.01"
                      className="bg-slate-800/50 border-slate-600 text-white mt-2"
                    />
                  </div>

                  {/* ETH Fee Preview */}
                  {ethTo && ethAmount && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Button 
                          onClick={previewEthFee} 
                          disabled={ethFeeLoading}
                          variant="outline" 
                          size="sm"
                          className="border-purple-500/30 text-purple-300 hover:bg-purple-500/20"
                        >
                          {ethFeeLoading ? "Calculating..." : "Preview Fee"}
                        </Button>
                      </div>
                      
                      {ethFeePreview && (
                        <div className="p-4 bg-slate-800/30 border border-slate-600/30 rounded-lg space-y-2">
                          <h4 className="text-sm font-medium text-purple-300">Fee Preview</h4>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="text-slate-400">Gas Limit:</div>
                            <div className="text-white">{ethFeePreview.estimatedGasLimit.toLocaleString()}</div>
                            
                            <div className="text-slate-400">Base Fee:</div>
                            <div className="text-white">{(Number(ethFeePreview.baseFeePerGas) / 1e9).toFixed(2)} Gwei</div>
                            
                            <div className="text-slate-400">Priority Fee:</div>
                            <div className="text-white">{(Number(ethFeePreview.maxPriorityFeePerGas) / 1e9).toFixed(2)} Gwei</div>
                            
                            <div className="text-slate-400">Max Fee:</div>
                            <div className="text-white">{(Number(ethFeePreview.maxFeePerGas) / 1e9).toFixed(2)} Gwei</div>
                            
                            <div className="text-slate-400">Total Fee:</div>
                            <div className="text-white">{ethFeePreview.totalFeeEth.toFixed(6)} ETH</div>
                            
                            <div className="text-slate-400">Speed:</div>
                            <div className="text-white capitalize">{ethFeePreview.transactionSpeed}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-400">Gas params use defaults; fee history used internally</div>
                    <Button onClick={submitEth} disabled={ethSubmitting || !ethTo || !ethAmount} className="bg-purple-600 hover:bg-purple-700 glow-purple">
                      {ethSubmitting ? (<><Send className="h-4 w-4 mr-2 animate-spin" />Sending...</>) : (<><Send className="h-4 w-4 mr-2" />Send ETH</>)}
                    </Button>
                  </div>

                  {ethTxHash && (
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-300 text-sm flex items-center">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Transaction Hash: {ethTxHash}
                    </div>
                  )}
                  {ethError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      {ethError}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        )}
      </div>
    </div>
  )
}


