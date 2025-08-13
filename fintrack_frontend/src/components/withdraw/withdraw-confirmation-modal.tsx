"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertTriangle, CheckCircle, Shield, ArrowUpFromLine } from "lucide-react"

interface WithdrawConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  asset: {
    symbol: string
    name: string
    network: string
    fee: string
    feeUsd: string
  }
  address: string
  amount: string
  receiveAmount: string
}

export function WithdrawConfirmationModal({
  isOpen,
  onClose,
  asset,
  address,
  amount,
  receiveAmount,
}: WithdrawConfirmationModalProps) {
  const [confirmationCode, setConfirmationCode] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  const handleConfirm = async () => {
    setIsProcessing(true)
    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsProcessing(false)
    setIsComplete(true)

    // Auto close after success
    setTimeout(() => {
      onClose()
      setIsComplete(false)
      setConfirmationCode("")
    }, 3000)
  }

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 8)}...${addr.slice(-8)}`
  }

  if (isComplete) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-slate-900 border-green-500/20 glow-green max-w-md">
          <div className="text-center py-8">
            <div className="flex justify-center mb-4">
              <div className="p-4 rounded-full bg-green-500/20 glow-green">
                <CheckCircle className="h-12 w-12 text-green-400" />
              </div>
            </div>
            <h3 className="text-xl font-heading font-bold text-white mb-2">Withdrawal Submitted!</h3>
            <p className="text-slate-400 mb-4">Your withdrawal request has been submitted successfully.</p>
            <div className="text-sm text-slate-500">
              Transaction ID: <span className="text-purple-400 font-mono">0x7a8b9c...</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-purple-500/20 glow-purple max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-bold text-white flex items-center">
            <Shield className="h-6 w-6 text-purple-400 mr-2" />
            Confirm Withdrawal
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Warning */}
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
              <div>
                <div className="text-red-400 font-semibold text-sm">Warning</div>
                <div className="text-red-300 text-sm">
                  This action cannot be undone. Please verify all details carefully.
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Details */}
          <div className="space-y-4">
            <div className="p-4 bg-slate-800/50 rounded-lg space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Asset</span>
                <span className="text-white font-semibold">
                  {asset.name} ({asset.symbol})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Network</span>
                <span className="text-white">{asset.network}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Destination</span>
                <span className="text-white font-mono text-sm">{truncateAddress(address)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount</span>
                <span className="text-white font-semibold">
                  {amount} {asset.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Network Fee</span>
                <span className="text-white">
                  {asset.fee} {asset.symbol} ({asset.feeUsd})
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-700 pt-3">
                <span className="text-white font-semibold">You'll Receive</span>
                <span className="text-purple-400 font-bold">
                  {receiveAmount} {asset.symbol}
                </span>
              </div>
            </div>
          </div>

          {/* 2FA Code */}
          <div className="space-y-2">
            <Label className="text-slate-300">2FA Authentication Code</Label>
            <Input
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              placeholder="Enter 6-digit code"
              className="bg-slate-800/50 border-slate-600 focus:border-purple-500 focus:ring-purple-500/20 text-white text-center font-mono text-lg"
              maxLength={6}
            />
            <p className="text-xs text-slate-500">Enter the 6-digit code from your authenticator app</p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800/50 bg-transparent"
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={confirmationCode.length !== 6 || isProcessing}
              className="flex-1 bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-700 hover:to-cyan-600 glow-purple text-white font-semibold"
            >
              {isProcessing ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Processing...
                </div>
              ) : (
                <>
                  <ArrowUpFromLine className="mr-2 h-4 w-4" />
                  Confirm Withdrawal
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
