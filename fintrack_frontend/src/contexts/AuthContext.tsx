"use client"

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { authService, balanceService, currencyService, transactionService } from "@/services/backend"

type CurrencyCode = "USD" | "IDR"

type AuthContextValue = {
  isLoggedIn: boolean
  user: string | null
  currency: CurrencyCode
  loading: boolean
  handleLogin: () => Promise<void>
  handleLogout: () => Promise<void>
  setCurrency: React.Dispatch<React.SetStateAction<CurrencyCode>>
  getCurrencyRates: typeof currencyService.getCurrencyRates
  fetchRealTimeRates: typeof currencyService.fetchRealTimeRates
  convertToDisplayCurrency: (usdAmount: number, rates: { usd_to_idr: number }) => number
  getCurrencySymbol: () => string
  formatCurrency: (amount: number, currencyCode: string) => string
  getBalanceBreakdown: typeof balanceService.getPortfolioSummary
  getPortfolioSummary: typeof balanceService.getPortfolioSummary
  getTransactions: typeof transactionService.getTransactions
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState<string | null>(null)
  const [currency, setCurrency] = useState<CurrencyCode>("USD")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true)
        const isAuth = await authService.init()
        setIsLoggedIn(isAuth)
        if (isAuth) {
          const currentUser = await authService.getCurrentUser()
          setUser(currentUser)
        }
      } finally {
        setLoading(false)
      }
    }
    const t = setTimeout(initialize, 300)
    return () => clearTimeout(t)
  }, [])

  // Listen for auth state changes from popup login
  useEffect(() => {
    const handleAuthStateChange = async (event: CustomEvent) => {
      const { isAuthenticated } = event.detail
      if (isAuthenticated) {
        // User just logged in via popup, refresh auth state
        try {
          setLoading(true)
          const isAuth = await authService.isAuthenticated()
          setIsLoggedIn(isAuth)
          if (isAuth) {
            const currentUser = await authService.getCurrentUser()
            setUser(currentUser)
          }
        } catch (error) {
          console.error('Error refreshing auth state:', error)
        } finally {
          setLoading(false)
        }
      } else {
        // User logged out
        setIsLoggedIn(false)
        setUser(null)
      }
    }

    window.addEventListener('authStateChanged', handleAuthStateChange as unknown as EventListener)
    return () => {
      window.removeEventListener('authStateChanged', handleAuthStateChange as unknown as EventListener)
    }
  }, [])

  const handleLogin = async () => {
    setLoading(true)
    try {
      await authService.login()
      // Auto-refresh will be handled by the event listener
      // No need for manual refresh or delay
    } catch (error) {
      console.error('Login error:', error)
      setLoading(false)
      // Show error to user if needed
      if (error instanceof Error && error.message.includes('timeout')) {
        console.warn('Login timeout - user may need to try again')
      }
    }
  }

  const handleLogout = async () => {
    await authService.logout()
    setIsLoggedIn(false)
    setUser(null)
  }

  const convertToDisplayCurrency = (usdAmount: number, rates: { usd_to_idr: number }): number => {
    if (currency === "USD") return usdAmount
    if (currency === "IDR" && rates.usd_to_idr > 0) return usdAmount * rates.usd_to_idr
    return usdAmount
  }

  const getCurrencySymbol = (): string => {
    switch (currency) {
      case "IDR": return "Rp"
      case "USD": return "$"
      default: return "$"
    }
  }

  const formatCurrency = (amount: number, currencyCode: string): string => {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: currencyCode === "BTC" ? 8 : 2,
    })
    return formatter.format(amount)
  }

  const value: AuthContextValue = {
    isLoggedIn,
    user,
    loading,
    handleLogin,
    handleLogout,
    currency,
    setCurrency,
    getCurrencyRates: currencyService.getCurrencyRates,
    fetchRealTimeRates: currencyService.fetchRealTimeRates,
    convertToDisplayCurrency,
    getCurrencySymbol,
    formatCurrency,
    getBalanceBreakdown: balanceService.getPortfolioSummary,
    getPortfolioSummary: balanceService.getPortfolioSummary,
    getTransactions: transactionService.getTransactions,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export { AuthContext }


