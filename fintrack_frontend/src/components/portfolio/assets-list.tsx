"use client"

import { useEffect, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Coins, TrendingUp, TrendingDown, MoreHorizontal, RefreshCw } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { balanceService, currencyService, marketChartService } from "@/services/backend"
import Image from "next/image"

type Asset = {
  symbol: string
  name: string
  amount: string
  value: string
  price: string
  change: string
  changeValue: string
  isPositive: boolean
}

// Function to get asset logo based on symbol
const getAssetLogo = (symbol: string) => {
  const logoMap: { [key: string]: string } = {
    'BTC': '/bitcoin.svg',
    'ETH': '/ethereum.svg',
    'ckBTC': '/ckbtc.svg',
    'ckETH': '/cketh.svg',
    'USDC': '/usdc.svg',
    'WETH': '/weth.svg'
  }
  return logoMap[symbol] || '/bitcoin.svg' // fallback to bitcoin logo
}

export function AssetsList() {
  const { isLoggedIn } = useAuth()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!isLoggedIn) return
    setLoading(true)
    setError(null)
    
    
    try {
      // Get combined portfolio summary (ck assets + native)
      const summaryRes = await balanceService.getPortfolioSummary()
      if (!summaryRes.success) {
        setError("Failed to load portfolio summary")
        return
      }
      console.log("summaryRes", summaryRes)
      const sum = summaryRes.data as any

      const ckbtcSats = Number(sum.ckbtc_balance ?? 0)
      const ckethWei = Number(sum.cketh_balance ?? 0)
      const btcNativeSats = Number(sum.btc_native_balance ?? 0)
      const ethNativeWei = Number(sum.eth_native_balance ?? 0)
      const usdcAmount = Number(sum.usdc_balance ?? 0) / 1e6 // USDC has 6 decimals
      const wethAmount = Number(sum.weth_balance ?? 0) / 1e18 // WETH has 18 decimals
      

      const ckbtcAmount = ckbtcSats / 1e8
      const btcAmount = btcNativeSats / 1e8
      const ckethAmount = ckethWei / 1e18
      const ethAmount = ethNativeWei / 1e18

      // Live USD rates from backend
      const ratesRes = await currencyService.getCurrencyRates()
      if (!ratesRes.success) {
        setError("Failed to load rates")
        return
      }
      const btcPrice = ratesRes.data.btc_to_usd
      const ethPrice = ratesRes.data.eth_to_usd
      
      const btcValue = btcAmount * btcPrice
      const ethValue = ethAmount * ethPrice
      const ckbtcValue = ckbtcAmount * btcPrice
      const ckethValue = ckethAmount * ethPrice
      const usdcValue = usdcAmount * 1 // USDC is pegged to $1
      const wethValue = wethAmount * ethPrice // WETH price = ETH price
      
      // Get real 24h changes from CoinGecko API
      let btcChange = 0
      let ethChange = 0
      let usdcChange = 0
      let wethChange = 0
      
      try {
        // Get 24h changes for BTC, ETH, and USDC
        const [btcChangeRes, ethChangeRes, usdcChangeRes] = await Promise.all([
          marketChartService.get24hChange('bitcoin'),
          marketChartService.get24hChange('ethereum'),
          marketChartService.get24hChange('usd-coin')
        ])
        
        btcChange = btcChangeRes.success ? btcChangeRes.data : 0
        ethChange = ethChangeRes.success ? ethChangeRes.data : 0
        usdcChange = usdcChangeRes.success ? usdcChangeRes.data : 0
        
        // WETH follows ETH price changes
        wethChange = ethChange
        
        console.log('24h Changes:', { btcChange, ethChange, usdcChange, wethChange })
        
      } catch (error) {
        console.warn('Failed to fetch 24h changes, using 0:', error)
        // Keep all changes as 0 if API fails
      }
      
      const newAssets: Asset[] = []
      
      // ckAssets (Internet Computer wrapped tokens)
      if (ckbtcAmount > 0) {
        newAssets.push({
          symbol: "ckBTC",
          name: "ckBitcoin",
          amount: ckbtcAmount.toFixed(4),
          value: `$${ckbtcValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          price: `$${btcPrice.toLocaleString()}`,
          change: `${btcChange >= 0 ? '+' : ''}${btcChange.toFixed(2)}%`,
          changeValue: `${btcChange >= 0 ? '+' : ''}$${(ckbtcValue * btcChange / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          isPositive: btcChange >= 0,
        })
      }

      if (ckethAmount > 0) {
        newAssets.push({
          symbol: "ckETH",
          name: "ckEthereum",
          amount: ckethAmount.toFixed(4),
          value: `$${ckethValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          price: `$${ethPrice.toLocaleString()}`,
          change: `${ethChange >= 0 ? '+' : ''}${ethChange.toFixed(2)}%`,
          changeValue: `${ethChange >= 0 ? '+' : ''}$${(ckethValue * ethChange / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          isPositive: ethChange >= 0,
        })
      }

      // Native ETH assets
      if (ethAmount > 0) {
        newAssets.push({
          symbol: "ETH",
          name: "Ethereum",
          amount: ethAmount.toFixed(4),
          value: `$${ethValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          price: `$${ethPrice.toLocaleString()}`,
          change: `${ethChange >= 0 ? '+' : ''}${ethChange.toFixed(2)}%`,
          changeValue: `${ethChange >= 0 ? '+' : ''}$${(ethValue * ethChange / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          isPositive: ethChange >= 0,
        })
      }

      if (wethAmount > 0) {
        newAssets.push({
          symbol: "WETH",
          name: "Wrapped Ethereum",
          amount: wethAmount.toFixed(4),
          value: `$${wethValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          price: `$${ethPrice.toLocaleString()}`,
          change: `${wethChange >= 0 ? '+' : ''}${wethChange.toFixed(2)}%`,
          changeValue: `${wethChange >= 0 ? '+' : ''}$${(wethValue * wethChange / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          isPositive: wethChange >= 0,
        })
      }

      // Native BTC assets
      if (btcAmount > 0) {
        newAssets.push({
          symbol: "BTC",
          name: "Bitcoin",
          amount: btcAmount.toFixed(4),
          value: `$${btcValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          price: `$${btcPrice.toLocaleString()}`,
          change: `${btcChange >= 0 ? '+' : ''}${btcChange.toFixed(2)}%`,
          changeValue: `${btcChange >= 0 ? '+' : ''}$${(btcValue * btcChange / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          isPositive: btcChange >= 0,
        })
      }

      // ERC20 tokens - only show if amount > 0.01 (1 cent) to avoid dust
      if (usdcAmount > 0) {
        newAssets.push({
          symbol: "USDC",
          name: "USD Coin",
          amount: usdcAmount.toFixed(2),
          value: `$${usdcValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          price: `$1.00`,
          change: `${usdcChange >= 0 ? '+' : ''}${usdcChange.toFixed(2)}%`,
          changeValue: `${usdcChange >= 0 ? '+' : ''}$${(usdcValue * usdcChange / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          isPositive: usdcChange >= 0,
        })
      }

      if (wethAmount > 0) { // Show WETH if amount > 0.001 ETH
        newAssets.push({
          symbol: "WETH",
          name: "Wrapped Ethereum",
          amount: wethAmount.toFixed(4),
          value: `$${wethValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          price: `$${ethPrice.toLocaleString()}`,
          change: `${wethChange >= 0 ? '+' : ''}${wethChange.toFixed(2)}%`,
          changeValue: `${wethChange >= 0 ? '+' : ''}$${(wethValue * wethChange / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          isPositive: wethChange >= 0,
        })
      }
      
      setAssets(newAssets)
    } catch (e: any) {
      setError(e?.message || "Failed to load assets data")
    } finally {
      setLoading(false)
    }
  }, [isLoggedIn])

  useEffect(() => {
    void loadData()
  }, [loadData])

  if (!isLoggedIn) {
    return (
      <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
        <div className="text-slate-400 text-center py-8">
         Please Login First
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
        <div className="text-red-400 text-center py-8">
          Error: {error}
        </div>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
        <div className="text-slate-400 text-center py-8">
        Loading assets...
        </div>
      </Card>
    )
  }

  if (assets.length === 0) {
    return (
      <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Coins className="h-5 w-4 text-purple-400" />
            <h3 className="font-heading font-semibold text-white text-lg">Your Assets</h3>
          </div>
          <button
            onClick={() => void loadData()}
            className="p-2 text-slate-400 hover:text-white transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="text-slate-400 text-center py-8">
          Tidak ada assets untuk ditampilkan
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Coins className="h-5 w-5 text-purple-400" />
          <h3 className="font-heading font-semibold text-white text-lg">Your Assets</h3>
        </div>
        <button
          onClick={() => void loadData()}
          className="p-2 text-slate-400 hover:text-white transition-colors"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Table Headers */}
      <div className="grid grid-cols-6 gap-4 text-xs text-slate-400 mb-4 px-2">
        <span>Asset</span>
        <span className="text-right">Holdings</span>
        <span className="text-right">Price</span>
        <span className="text-right">24h Change</span>
        <span className="text-right">Value</span>
        <span></span>
      </div>

      {/* Assets List */}
      <div className="space-y-4">
        {/* ckAssets Section */}
        {assets.filter(asset => ['ckBTC', 'ckETH'].includes(asset.symbol)).length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-purple-400 mb-2 px-2">ckAssets (Internet Computer)</h4>
            <div className="space-y-2">
              {assets.filter(asset => ['ckBTC', 'ckETH'].includes(asset.symbol)).map((asset) => (
                <div
                  key={asset.symbol}
                  className="grid grid-cols-6 gap-4 items-center py-3 px-2 hover:bg-slate-800/50 rounded-lg transition-colors group"
                >
                  {/* Asset Info */}
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                      <Image
                        src={getAssetLogo(asset.symbol)}
                        alt={asset.symbol}
                        width={24}
                        height={24}
                        className="w-6 h-6"
                      />
                    </div>
                    <div>
                      <div className="text-white font-semibold text-sm">{asset.symbol}</div>
                      <div className="text-slate-400 text-xs">{asset.name}</div>
                    </div>
                  </div>

                  {/* Holdings */}
                  <div className="text-right">
                    <div className="text-white font-mono text-sm">{asset.amount}</div>
                    <div className="text-slate-400 text-xs">{asset.symbol}</div>
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <div className="text-white font-mono text-sm">{asset.price}</div>
                  </div>

                  {/* 24h Change */}
                  <div className="text-right">
                    <div
                      className={`flex items-center justify-end space-x-1 ${asset.isPositive ? "text-green-400" : "text-red-400"}`}
                    >
                      {asset.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      <span className="font-semibold text-sm">{asset.change}</span>
                    </div>
                    <div className={`text-xs ${asset.isPositive ? "text-green-400/70" : "text-red-400/70"}`}>
                      {asset.changeValue}
                    </div>
                  </div>

                  {/* Value */}
                  <div className="text-right">
                    <div className="text-white font-semibold text-sm">{asset.value}</div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-white"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Native ETH Assets Section */}
        {assets.filter(asset => ['ETH', 'WETH'].includes(asset.symbol)).length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-blue-400 mb-2 px-2">Native ETH Assets</h4>
            <div className="space-y-2">
              {assets.filter(asset => ['ETH', 'WETH'].includes(asset.symbol)).map((asset) => (
                <div
                  key={asset.symbol}
                  className="grid grid-cols-6 gap-4 items-center py-3 px-2 hover:bg-slate-800/50 rounded-lg transition-colors group"
                >
                  {/* Asset Info */}
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                      <Image
                        src={getAssetLogo(asset.symbol)}
                        alt={asset.symbol}
                        width={24}
                        height={24}
                        className="w-6 h-6"
                      />
                    </div>
                    <div>
                      <div className="text-white font-semibold text-sm">{asset.symbol}</div>
                      <div className="text-slate-400 text-xs">{asset.name}</div>
                    </div>
                  </div>

                  {/* Holdings */}
                  <div className="text-right">
                    <div className="text-white font-mono text-sm">{asset.amount}</div>
                    <div className="text-slate-400 text-xs">{asset.symbol}</div>
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <div className="text-white font-mono text-sm">{asset.price}</div>
                  </div>

                  {/* 24h Change */}
                  <div className="text-right">
                    <div
                      className={`flex items-center justify-end space-x-1 ${asset.isPositive ? "text-green-400" : "text-red-400"}`}
                    >
                      {asset.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      <span className="font-semibold text-sm">{asset.change}</span>
                    </div>
                    <div className={`text-xs ${asset.isPositive ? "text-green-400/70" : "text-red-400/70"}`}>
                      {asset.changeValue}
                    </div>
                  </div>

                  {/* Value */}
                  <div className="text-right">
                    <div className="text-white font-semibold text-sm">{asset.value}</div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-white"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Native BTC Assets Section */}
        {assets.filter(asset => ['BTC'].includes(asset.symbol)).length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-orange-400 mb-2 px-2">Native BTC Assets</h4>
            <div className="space-y-2">
              {assets.filter(asset => ['BTC'].includes(asset.symbol)).map((asset) => (
                <div
                  key={asset.symbol}
                  className="grid grid-cols-6 gap-4 items-center py-3 px-2 hover:bg-slate-800/50 rounded-lg transition-colors group"
                >
                  {/* Asset Info */}
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                      <Image
                        src={getAssetLogo(asset.symbol)}
                        alt={asset.symbol}
                        width={24}
                        height={24}
                        className="w-6 h-6"
                      />
                    </div>
                    <div>
                      <div className="text-white font-semibold text-sm">{asset.symbol}</div>
                      <div className="text-slate-400 text-xs">{asset.name}</div>
                    </div>
                  </div>

                  {/* Holdings */}
                  <div className="text-right">
                    <div className="text-white font-mono text-sm">{asset.amount}</div>
                    <div className="text-slate-400 text-xs">{asset.symbol}</div>
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <div className="text-white font-mono text-sm">{asset.price}</div>
                  </div>

                  {/* 24h Change */}
                  <div className="text-right">
                    <div
                      className={`flex items-center justify-end space-x-1 ${asset.isPositive ? "text-green-400" : "text-red-400"}`}
                    >
                      {asset.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      <span className="font-semibold text-sm">{asset.change}</span>
                    </div>
                    <div className={`text-xs ${asset.isPositive ? "text-green-400/70" : "text-red-400/70"}`}>
                      {asset.changeValue}
                    </div>
                  </div>

                  {/* Value */}
                  <div className="text-right">
                    <div className="text-white font-semibold text-sm">{asset.value}</div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-white"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ERC20 Tokens Section */}
        {assets.filter(asset => ['USDC'].includes(asset.symbol)).length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-green-400 mb-2 px-2">ERC20 Tokens</h4>
            <div className="space-y-2">
              {assets.filter(asset => ['USDC'].includes(asset.symbol)).map((asset) => (
                <div
                  key={asset.symbol}
                  className="grid grid-cols-6 gap-4 items-center py-3 px-2 hover:bg-slate-800/50 rounded-lg transition-colors group"
                >
                  {/* Asset Info */}
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                      <Image
                        src={getAssetLogo(asset.symbol)}
                        alt={asset.symbol}
                        width={24}
                        height={24}
                        className="w-6 h-6"
                      />
                    </div>
                    <div>
                      <div className="text-white font-semibold text-sm">{asset.symbol}</div>
                      <div className="text-slate-400 text-xs">{asset.name}</div>
                    </div>
                  </div>

                  {/* Holdings */}
                  <div className="text-right">
                    <div className="text-white font-mono text-sm">{asset.amount}</div>
                    <div className="text-slate-400 text-xs">{asset.symbol}</div>
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <div className="text-white font-mono text-sm">{asset.price}</div>
                  </div>

                  {/* 24h Change */}
                  <div className="text-right">
                    <div
                      className={`flex items-center justify-end space-x-1 ${asset.isPositive ? "text-green-400" : "text-red-400"}`}
                    >
                      {asset.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      <span className="font-semibold text-sm">{asset.change}</span>
                    </div>
                    <div className={`text-xs ${asset.isPositive ? "text-green-400/70" : "text-red-400/70"}`}>
                      {asset.changeValue}
                    </div>
                  </div>

                  {/* Value */}
                  <div className="text-right">
                    <div className="text-white font-semibold text-sm">{asset.value}</div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-white"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
