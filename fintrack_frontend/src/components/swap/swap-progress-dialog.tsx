"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, Clock, XCircle, ExternalLink, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export interface SwapStep {
  id: string
  title: string
  description: string
  status: 'pending' | 'loading' | 'success' | 'error'
  txHash?: string
  error?: string
}

interface SwapProgressDialogProps {
  isOpen: boolean
  onClose: () => void
  steps: SwapStep[]
  onRetry?: (stepId: string) => void
}

export function SwapProgressDialog({ isOpen, onClose, steps, onRetry }: SwapProgressDialogProps) {
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState<string | null>(null)

  useEffect(() => {
    // Find the current step (loading or first pending)
    const loadingStep = steps.find(step => step.status === 'loading')
    const firstPendingStep = steps.find(step => step.status === 'pending')
    
    if (loadingStep) {
      setCurrentStep(loadingStep.id)
    } else if (firstPendingStep) {
      setCurrentStep(firstPendingStep.id)
    } else {
      setCurrentStep(null)
    }
  }, [steps])

  const getStepIcon = (step: SwapStep) => {
    switch (step.status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'loading':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
      case 'pending':
      default:
        return <Clock className="w-5 h-5 text-slate-400" />
    }
  }

  const getStepStatusColor = (step: SwapStep) => {
    switch (step.status) {
      case 'success':
        return 'border-green-500/50 bg-green-500/10'
      case 'error':
        return 'border-red-500/50 bg-red-500/10'
      case 'loading':
        return 'border-blue-500/50 bg-blue-500/10'
      case 'pending':
      default:
        return 'border-slate-700 bg-slate-800/50'
    }
  }

  const isCompleted = steps.every(step => step.status === 'success')
  const hasError = steps.some(step => step.status === 'error')

  const handleViewTransaction = (txHash: string) => {
    window.open(`https://sepolia.etherscan.io/tx/${txHash}`, '_blank')
  }

  const handleRetry = (stepId: string) => {
    if (onRetry) {
      onRetry(stepId)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-semibold">
            {isCompleted ? "Swap Completed!" : hasError ? "Swap Failed" : "Processing Swap"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {steps.map((step, index) => (
            <Card 
              key={step.id} 
              className={`transition-all duration-300 ${getStepStatusColor(step)} ${
                currentStep === step.id ? 'ring-2 ring-blue-500/50' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getStepIcon(step)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-white">
                        {step.title}
                      </h3>
                      {step.status === 'loading' && (
                        <div className="text-xs text-blue-400">
                          Processing...
                        </div>
                      )}
                    </div>
                    
                    <p className="text-xs text-slate-400 mt-1">
                      {step.description}
                    </p>
                    
                    {step.txHash && (
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewTransaction(step.txHash!)}
                          className="h-7 px-2 text-xs"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          View TX
                        </Button>
                        <span className="text-xs text-slate-500 font-mono">
                          {step.txHash.slice(0, 10)}...{step.txHash.slice(-8)}
                        </span>
                      </div>
                    )}
                    
                    {step.error && (
                      <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                        {step.error}
                      </div>
                    )}
                    
                    {step.status === 'error' && onRetry && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRetry(step.id)}
                        className="mt-2 h-7 px-2 text-xs"
                      >
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {isCompleted && (
            <div className="text-center pt-4">
              <Button onClick={onClose} className="w-full">
                Close
              </Button>
            </div>
          )}
          
          {hasError && !isCompleted && (
            <div className="text-center pt-4">
              <Button variant="outline" onClick={onClose} className="w-full">
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
