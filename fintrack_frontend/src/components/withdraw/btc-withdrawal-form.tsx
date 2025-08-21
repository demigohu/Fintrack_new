"use client"

import { useState, useEffect } from "react"
import { useBtcWithdrawal } from "@/hooks/useData"
import { bitcoinService } from "@/services/backend"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle, XCircle, AlertCircle, Calculator } from "lucide-react"

interface BtcWithdrawalFormProps {
  onSuccess?: (blockIndex: string) => void
}

export function BtcWithdrawalForm({ onSuccess }: BtcWithdrawalFormProps) {
  const [address, setAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [feePreview, setFeePreview] = useState<any>(null)
  const [feeLoading, setFeeLoading] = useState(false)
  const { withdrawalStatus, error, blockIndex, withdrawBtc, resetWithdrawal, isLoading } = useBtcWithdrawal()

  // Calculate fee preview when amount changes
  useEffect(() => {
    const calculateFee = async () => {
      if (!amount || !address || parseFloat(amount) <= 0) {
        setFeePreview(null)
        return
      }
      
      setFeeLoading(true)
      try {
        const amountInSats = BigInt(parseFloat(amount) * 100_000_000)
        const result = await bitcoinService.previewBtcFee(address, amountInSats)
        if (result.success) {
          setFeePreview(result.data)
        } else {
          setFeePreview(null)
        }
      } catch (error) {
        setFeePreview(null)
      } finally {
        setFeeLoading(false)
      }
    }

    const timeoutId = setTimeout(calculateFee, 500) // Debounce
    return () => clearTimeout(timeoutId)
  }, [amount, address])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!address.trim() || !amount.trim()) {
      return
    }

    const amountBigInt = BigInt(parseFloat(amount) * 100_000_000) // Convert BTC to satoshis
    await withdrawBtc(address.trim(), amountBigInt)
  }

  const handleReset = () => {
    resetWithdrawal()
    setAddress("")
    setAmount("")
  }

  // Show success state
  if (withdrawalStatus === 'success' && blockIndex) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <CardTitle className="text-green-600">Withdrawal Successful!</CardTitle>
                  <CardDescription>
          Your BTC withdrawal has been processed successfully.
        </CardDescription>
        <div className="mt-2 text-sm text-gray-600">
          <p>Amount withdrawn: {amount} BTC</p>
          {feePreview && (
            <p>Fee paid: {(feePreview.estimatedFeeSats / 100_000_000).toFixed(8)} BTC</p>
          )}
        </div>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">Block Index:</p>
            <p className="font-mono text-sm">{blockIndex}</p>
          </div>
          <div className="space-y-2">
            <Button onClick={handleReset} className="w-full">
              Make Another Withdrawal
            </Button>
            {onSuccess && (
              <Button variant="outline" onClick={() => onSuccess(blockIndex)} className="w-full">
                View Details
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show error state
  if (withdrawalStatus === 'error') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <XCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <CardTitle className="text-red-600">Withdrawal Failed</CardTitle>
          <CardDescription>
            There was an error processing your withdrawal.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button onClick={handleReset} className="w-full">
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Withdraw BTC</CardTitle>
        <CardDescription>
          Enter the destination address and amount to withdraw your BTC.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">Bitcoin Address</Label>
            <Input
              id="address"
              type="text"
              placeholder="bc1q..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (BTC)</Label>
            <Input
              id="amount"
              type="number"
              step="0.00000001"
              min="0.00000001"
              placeholder="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isLoading}
              required
            />
            <p className="text-xs text-gray-500">
              Minimum withdrawal: 0.000001 BTC
            </p>
            
            {/* Fee Preview */}
            {feeLoading && (
              <div className="flex items-center gap-2 text-xs text-blue-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Calculating fees...
              </div>
            )}
            
            {feePreview && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Calculator className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-blue-700">Fee Preview</span>
                </div>
                <div className="space-y-1 text-xs text-blue-600">
                  <div className="flex justify-between">
                    <span>Amount to withdraw:</span>
                    <span>{parseFloat(amount).toFixed(8)} BTC</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated fee:</span>
                    <span>{(feePreview.estimatedFeeSats / 100_000_000).toFixed(8)} BTC</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-1">
                    <span>You will receive:</span>
                    <span>{(parseFloat(amount) - (feePreview.estimatedFeeSats / 100_000_000)).toFixed(8)} BTC</span>
                  </div>
                  <div className="text-xs text-blue-500 mt-1">
                    Confirmation time: {feePreview.confirmationTimeEstimate}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || !address.trim() || !amount.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {withdrawalStatus === 'approving' ? 'Approving...' : 'Withdrawing...'}
              </>
            ) : (
              'Withdraw BTC'
            )}
          </Button>
        </form>

        {withdrawalStatus === 'approving' && (
          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Step 1: Approving withdrawal on ckBTC ledger...
            </AlertDescription>
          </Alert>
        )}

        {withdrawalStatus === 'withdrawing' && (
          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Step 2: Processing withdrawal request...
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
