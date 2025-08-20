"use client"

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { transactionService, bitcoinService, ethereumService } from '../services/backend';

export const useTransactions = () => {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isLoggedIn } = useAuth()

  const fetchTransactions = useCallback(async () => {
    if (!isLoggedIn) return
    setLoading(true)
    setError(null)
    const res = await transactionService.getTransactions()
    if (res.success) setTransactions(res.data)
    else setError(res.error)
    setLoading(false)
  }, [isLoggedIn])

  useEffect(() => { void fetchTransactions() }, [fetchTransactions])

  return { transactions, loading, error, fetchTransactions }
}

export const useBitcoin = () => {
  const [btcBalance, setBtcBalance] = useState<bigint | null>(null)
  const [btcAddress, setBtcAddress] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isLoggedIn, user } = useAuth()

  const load = useCallback(async () => {
    if (!isLoggedIn || !user) return
    setLoading(true)
    setError(null)
    try {
      const [balanceResult, addressResult] = await Promise.all([
        bitcoinService.getBtcBalance(),
        bitcoinService.getBtcDepositAddress()
      ])
      if (balanceResult.success) setBtcBalance(balanceResult.data)
      if (addressResult.success) setBtcAddress(addressResult.data)
      if (!balanceResult.success) setError(balanceResult.error)
      if (!addressResult.success) setError(addressResult.error)
    } catch (err: any) {
      setError(err?.message || 'Failed to load BTC data')
    } finally {
      setLoading(false)
    }
  }, [isLoggedIn, user])

  useEffect(() => {
    load()
  }, [load])

  return { btcBalance, btcAddress, loading, error, load }
}

// Hook untuk refresh BTC balance (mint ke ckBTC)
export const useRefreshBtcBalance = () => {
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { isLoggedIn, user } = useAuth()

  const refreshBalance = useCallback(async () => {
    if (!isLoggedIn || !user) return
    setRefreshing(true)
    setError(null)
    setSuccess(false)
    try {
      const result = await bitcoinService.refreshBtcBalance()
      if (result.success) {
        setSuccess(true)
        // Reset success state after 3 seconds
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError(result.error)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to refresh BTC balance')
    } finally {
      setRefreshing(false)
    }
  }, [isLoggedIn, user])

  return { refreshing, error, success, refreshBalance }
}

// Hook untuk ETH deposit ke helper contract
export const useEthDeposit = () => {
  const [depositing, setDepositing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [transactionHash, setTransactionHash] = useState<string | null>(null)
  const [principalBytes32, setPrincipalBytes32] = useState<string | null>(null)
  const { isLoggedIn, user } = useAuth()

  const depositEth = useCallback(async (amountInEth: string, helperContractAddress: string) => {
    if (!isLoggedIn || !user) {
      setError('User not authenticated')
      return
    }

    setDepositing(true)
    setError(null)
    setSuccess(false)
    setTransactionHash(null)
    setPrincipalBytes32(null)

    try {
      // Import service secara dinamis untuk menghindari SSR issues
      const { depositEthToContract } = await import('../services/ethDeposit')
      
      const result = await depositEthToContract(
        helperContractAddress,
        user, // user principal
        amountInEth
      )

      if (result.success && result.data) {
        setSuccess(true)
        setTransactionHash(result.data.hash)
        setPrincipalBytes32(result.data.principalBytes32)
        // Reset success state after 5 seconds
        setTimeout(() => {
          setSuccess(false)
          setTransactionHash(null)
          setPrincipalBytes32(null)
        }, 5000)
      } else {
        setError(result.error || 'Failed to deposit ETH')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to deposit ETH')
    } finally {
      setDepositing(false)
    }
  }, [isLoggedIn, user])

  const resetDeposit = useCallback(() => {
    setDepositing(false)
    setError(null)
    setSuccess(false)
    setTransactionHash(null)
    setPrincipalBytes32(null)
  }, [])

  return { 
    depositing, 
    error, 
    success, 
    transactionHash, 
    principalBytes32,
    depositEth, 
    resetDeposit 
  }
}

export const useBtcWithdrawal = () => {
  const [withdrawalStatus, setWithdrawalStatus] = useState<'idle' | 'approving' | 'withdrawing' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [blockIndex, setBlockIndex] = useState<string | null>(null)
  const { isLoggedIn, user } = useAuth()

  const withdrawBtc = useCallback(async (address: string, amount: bigint, subaccount?: Uint8Array) => {
    if (!isLoggedIn || !user) {
      setError('User not authenticated')
      return
    }

    try {
      setWithdrawalStatus('approving')
      setError(null)
      
      // Step 1: Approve withdrawal
      const approveResult = await bitcoinService.approveBtcWithdrawal(amount, subaccount)
      if (!approveResult.success) {
        setError(`Approval failed: ${approveResult.error}`)
        setWithdrawalStatus('error')
        return
      }

      setWithdrawalStatus('withdrawing')
      
      // Step 2: Execute withdrawal
      const withdrawResult = await bitcoinService.withdrawBtc(address, amount, subaccount)
      if (withdrawResult.success) {
        setBlockIndex(withdrawResult.data)
        setWithdrawalStatus('success')
      } else {
        setError(`Withdrawal failed: ${withdrawResult.error}`)
        setWithdrawalStatus('error')
      }
    } catch (err: any) {
      setError(err?.message || 'Withdrawal failed')
      setWithdrawalStatus('error')
    }
  }, [isLoggedIn, user])

  const resetWithdrawal = useCallback(() => {
    setWithdrawalStatus('idle')
    setError(null)
    setBlockIndex(null)
  }, [])

  return {
    withdrawalStatus,
    error,
    blockIndex,
    withdrawBtc,
    resetWithdrawal,
    isLoading: withdrawalStatus === 'approving' || withdrawalStatus === 'withdrawing'
  }
}

export const useCkethWithdrawal = () => {
  const [withdrawalStatus, setWithdrawalStatus] = useState<'idle' | 'approving' | 'withdrawing' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [withdrawalId, setWithdrawalId] = useState<string | null>(null)
  const { isLoggedIn, user } = useAuth()

  const withdrawCketh = useCallback(async (address: string, amount: bigint, subaccount?: Uint8Array) => {
    if (!isLoggedIn || !user) {
      setError('User not authenticated')
      return
    }

    try {
      setWithdrawalStatus('approving')
      setError(null)
      
      // Step 1: Approve withdrawal
      const approveResult = await ethereumService.approveCkethWithdrawal(amount, subaccount)
      if (!approveResult.success) {
        setError(`Approval failed: ${approveResult.error}`)
        setWithdrawalStatus('error')
        return
      }

      setWithdrawalStatus('withdrawing')
      
      // Step 2: Execute withdrawal
      const withdrawResult = await ethereumService.withdrawCketh(address, amount, subaccount)
      if (withdrawResult.success) {
        setWithdrawalId(withdrawResult.data)
        setWithdrawalStatus('success')
      } else {
        setError(`Withdrawal failed: ${withdrawResult.error}`)
        setWithdrawalStatus('error')
      }
    } catch (err: any) {
      setError(err?.message || 'Withdrawal failed')
      setWithdrawalStatus('error')
    }
  }, [isLoggedIn, user])

  const resetWithdrawal = useCallback(() => {
    setWithdrawalStatus('idle')
    setError(null)
    setWithdrawalId(null)
  }, [])

  return {
    withdrawalStatus,
    error,
    withdrawalId,
    withdrawCketh,
    resetWithdrawal,
    isLoading: withdrawalStatus === 'approving' || withdrawalStatus === 'withdrawing'
  }
}


