"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WithdrawConfirmationModal } from "@/components/withdraw/withdraw-confirmation-modal"
import { BtcWithdrawalForm } from "@/components/withdraw/btc-withdrawal-form"
import { CkethWithdrawalForm } from "@/components/withdraw/cketh-withdrawal-form"
import { ArrowUpFromLine, AlertTriangle, Info } from "lucide-react"

const cryptoAssets = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    network: "Bitcoin",
    balance: "1.3456",
    minWithdraw: "0.001",
    fee: "0.0005",
    feeUsd: "$21.63",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    network: "Ethereum (ERC-20)",
    balance: "13.67",
    minWithdraw: "0.01",
    fee: "0.005",
    feeUsd: "$13.38",
  },
  {
    symbol: "USDT",
    name: "Tether",
    network: "Ethereum (ERC-20)",
    balance: "12450.00",
    minWithdraw: "10",
    fee: "15",
    feeUsd: "$15.00",
  },
  {
    symbol: "SOL",
    name: "Solana",
    network: "Solana",
    balance: "156.23",
    minWithdraw: "0.1",
    fee: "0.01",
    feeUsd: "$0.99",
  },
]

export default function WithdrawPage() {
  const [selectedAsset, setSelectedAsset] = useState(cryptoAssets[0])
  const [withdrawAddress, setWithdrawAddress] = useState("")
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [showConfirmation, setShowConfirmation] = useState(false)

  const handleWithdraw = () => {
    if (withdrawAddress && withdrawAmount) {
      setShowConfirmation(true)
    }
  }

  const calculateReceiveAmount = () => {
    const amount = Number.parseFloat(withdrawAmount) || 0
    const fee = Number.parseFloat(selectedAsset.fee)
    return Math.max(0, amount - fee).toFixed(8)
  }

  const setMaxAmount = () => {
    const maxAmount = Math.max(0, Number.parseFloat(selectedAsset.balance) - Number.parseFloat(selectedAsset.fee))
    setWithdrawAmount(maxAmount.toString())
  }

  const handleBtcWithdrawalSuccess = (blockIndex: string) => {
    console.log("BTC withdrawal successful with block index:", blockIndex)
    // You can add navigation or other success handling here
  }

  const handleCkethWithdrawalSuccess = (withdrawalId: string) => {
    console.log("ckETH withdrawal successful with withdrawal ID:", withdrawalId)
    // You can add navigation or other success handling here
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-900">
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-white mb-2">Withdraw Crypto</h1>
          <p className="text-slate-400">Send your crypto to an external wallet</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Withdrawal Form */}
          <div className="space-y-6">
            {/* Asset Selection */}
            <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
              <h3 className="font-heading font-semibold text-white text-lg mb-4">Select Asset</h3>
              <Tabs
                defaultValue={selectedAsset.symbol}
                onValueChange={(value) => {
                  const asset = cryptoAssets.find((a) => a.symbol === value)
                  if (asset) setSelectedAsset(asset)
                }}
              >
                <TabsList className="grid w-full grid-cols-4 bg-slate-800/50">
                  {cryptoAssets.map((asset) => (
                    <TabsTrigger
                      key={asset.symbol}
                      value={asset.symbol}
                      className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:glow-purple"
                    >
                      {asset.symbol}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {cryptoAssets.map((asset) => (
                  <TabsContent key={asset.symbol} value={asset.symbol} className="mt-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-cyan-500 flex items-center justify-center text-white font-bold">
                            {asset.symbol.charAt(0)}
                          </div>
                          <div>
                            <div className="text-white font-semibold">{asset.name}</div>
                            <div className="text-slate-400 text-sm">{asset.network}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-semibold">{asset.balance}</div>
                          <div className="text-slate-400 text-sm">Available</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="p-3 bg-slate-800/30 rounded-lg">
                          <div className="text-slate-400">Min Withdraw</div>
                          <div className="text-white font-semibold">
                            {asset.minWithdraw} {asset.symbol}
                          </div>
                        </div>
                        <div className="p-3 bg-slate-800/30 rounded-lg">
                          <div className="text-slate-400">Network Fee</div>
                          <div className="text-white font-semibold">
                            {asset.fee} {asset.symbol}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </Card>

            {/* Withdrawal Form - Show BTC form for BTC, generic form for others */}
            {selectedAsset.symbol === "BTC" ? (
              <BtcWithdrawalForm onSuccess={handleBtcWithdrawalSuccess} />
            ) : selectedAsset.symbol === "ETH" ? (
              <CkethWithdrawalForm onSuccess={handleCkethWithdrawalSuccess} />
            ) : (
              <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
                <h3 className="font-heading font-semibold text-white text-lg mb-4">Withdrawal Details</h3>
                <div className="space-y-4">
                  {/* Destination Address */}
                  <div>
                    <Label className="text-slate-300">Destination Address</Label>
                    <Input
                      value={withdrawAddress}
                      onChange={(e) => setWithdrawAddress(e.target.value)}
                      placeholder={`Enter ${selectedAsset.name} address`}
                      className="bg-slate-800/50 border-slate-600 focus:border-purple-500 focus:ring-purple-500/20 text-white mt-2 font-mono"
                    />
                  </div>

                  {/* Amount */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-slate-300">Amount</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={setMaxAmount}
                        className="text-purple-400 hover:text-purple-300 text-xs"
                      >
                        Max: {selectedAsset.balance} {selectedAsset.symbol}
                      </Button>
                    </div>
                    <Input
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      className="bg-slate-800/50 border-slate-600 focus:border-purple-500 focus:ring-purple-500/20 text-white"
                    />
                  </div>

                  {/* Quick Amount Buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    {["25%", "50%", "75%", "Max"].map((percent) => (
                      <Button
                        key={percent}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const balance = Number.parseFloat(selectedAsset.balance)
                          const fee = Number.parseFloat(selectedAsset.fee)
                          let amount = 0

                          if (percent === "Max") {
                            amount = Math.max(0, balance - fee)
                          } else {
                            const percentage = Number.parseInt(percent) / 100
                            amount = balance * percentage
                          }

                          setWithdrawAmount(amount.toString())
                        }}
                        className="border-slate-600 text-slate-400 hover:border-purple-500/50 hover:text-purple-400 hover:bg-purple-500/10 bg-transparent"
                      >
                        {percent}
                      </Button>
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Withdrawal Summary */}
          <div className="space-y-6">
            {/* Transaction Summary */}
            <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
              <h3 className="font-heading font-semibold text-white text-lg mb-4">Transaction Summary</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                  <span className="text-slate-400">Withdraw Amount</span>
                  <span className="text-white font-semibold">
                    {withdrawAmount || "0"} {selectedAsset.symbol}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                  <span className="text-slate-400">Network Fee</span>
                  <span className="text-white font-semibold">
                    {selectedAsset.fee} {selectedAsset.symbol}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                  <span className="text-slate-400">Fee (USD)</span>
                  <span className="text-slate-400">{selectedAsset.feeUsd}</span>
                </div>
                <div className="flex justify-between items-center py-3 bg-purple-500/10 rounded-lg px-4">
                  <span className="text-white font-semibold">You&apos;ll Receive</span>
                  <span className="text-purple-400 font-bold text-lg">
                    {calculateReceiveAmount()} {selectedAsset.symbol}
                  </span>
                </div>
              </div>
            </Card>

            {/* Security Notice */}
            <Card className="p-6 bg-slate-900/80 border-yellow-500/20 glow-yellow">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-6 w-6 text-yellow-400 mt-1" />
                <div>
                  <h4 className="font-semibold text-yellow-400 mb-2">Security Notice</h4>
                  <ul className="text-sm text-yellow-300 space-y-1">
                    <li>• Double-check the destination address</li>
                    <li>• Ensure you&apos;re using the correct network</li>
                    <li>• Withdrawals cannot be reversed</li>
                    <li>• Allow up to 30 minutes for processing</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Withdraw Button - Only show for non-BTC/ETH assets */}
            {selectedAsset.symbol !== "BTC" && selectedAsset.symbol !== "ETH" && (
              <Button
                onClick={handleWithdraw}
                disabled={
                  !withdrawAddress ||
                  !withdrawAmount ||
                  Number.parseFloat(withdrawAmount) < Number.parseFloat(selectedAsset.minWithdraw)
                }
                className="w-full h-12 bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-700 hover:to-cyan-600 glow-purple hover:animate-pulse-glow text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowUpFromLine className="mr-2 h-5 w-5" />
                Withdraw {selectedAsset.symbol}
              </Button>
            )}

            {/* Info */}
            <div className="flex items-start space-x-2 text-xs text-slate-500">
              <Info className="h-4 w-4 mt-0.5" />
              <p>
                Minimum withdrawal: {selectedAsset.minWithdraw} {selectedAsset.symbol}. Processing time varies by
                network congestion.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal - Only show for non-BTC/ETH assets */}
      {selectedAsset.symbol !== "BTC" && selectedAsset.symbol !== "ETH" && (
        <WithdrawConfirmationModal
          isOpen={showConfirmation}
          onClose={() => setShowConfirmation(false)}
          asset={selectedAsset}
          address={withdrawAddress}
          amount={withdrawAmount}
          receiveAmount={calculateReceiveAmount()}
        />
      )}
    </div>
  )
}
