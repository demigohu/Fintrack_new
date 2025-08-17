"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, QrCode, CheckCircle, AlertTriangle } from "lucide-react"

const cryptoAssets = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    network: "Bitcoin",
    address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    minDeposit: "0.0001",
    confirmations: 3,
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    network: "Ethereum (ERC-20)",
    address: "0x742d35Cc6634C0532925a3b8D4C9db96590b5b8e",
    minDeposit: "0.01",
    confirmations: 12,
  },
  {
    symbol: "USDT",
    name: "Tether",
    network: "Ethereum (ERC-20)",
    address: "0x742d35Cc6634C0532925a3b8D4C9db96590b5b8e",
    minDeposit: "10",
    confirmations: 12,
  },
  {
    symbol: "SOL",
    name: "Solana",
    network: "Solana",
    address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    minDeposit: "0.1",
    confirmations: 1,
  },
]

export default function DepositPage() {
  const [selectedAsset, setSelectedAsset] = useState(cryptoAssets[0])
  const [customAmount, setCustomAmount] = useState("")
  const [copied, setCopied] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-900">
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-white mb-2">Deposit Crypto</h1>
          <p className="text-slate-400">Add funds to your CyberTrade account</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Asset Selection & Deposit Form */}
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
                      <div className="flex items-center space-x-3 p-4 bg-slate-800/50 rounded-lg">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-cyan-500 flex items-center justify-center text-white font-bold">
                          {asset.symbol.charAt(0)}
                        </div>
                        <div>
                          <div className="text-white font-semibold">{asset.name}</div>
                          <div className="text-slate-400 text-sm">{asset.network}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="p-3 bg-slate-800/30 rounded-lg">
                          <div className="text-slate-400">Min Deposit</div>
                          <div className="text-white font-semibold">
                            {asset.minDeposit} {asset.symbol}
                          </div>
                        </div>
                        <div className="p-3 bg-slate-800/30 rounded-lg">
                          <div className="text-slate-400">Confirmations</div>
                          <div className="text-white font-semibold">{asset.confirmations}</div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </Card>

            {/* Deposit Amount (Optional) */}
            <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
              <h3 className="font-heading font-semibold text-white text-lg mb-4">Amount (Optional)</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-300">Deposit Amount</Label>
                  <Input
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder={`Enter amount in ${selectedAsset.symbol}`}
                    className="bg-slate-800/50 border-slate-600 focus:border-purple-500 focus:ring-purple-500/20 text-white mt-2"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    This helps us track your deposit. Leave empty if you prefer not to specify.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Deposit Instructions */}
          <div className="space-y-6">
            {/* Wallet Address & QR Code */}
            <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
              <h3 className="font-heading font-semibold text-white text-lg mb-4">Deposit Address</h3>

              {/* QR Code */}
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-white rounded-lg">
                  <div className="w-48 h-48 bg-gradient-to-br from-slate-200 to-slate-300 rounded flex items-center justify-center">
                    <QrCode className="h-32 w-32 text-slate-600" />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-3">
                <Label className="text-slate-300">Wallet Address</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    value={selectedAsset.address}
                    readOnly
                    className="bg-slate-800/50 border-slate-600 text-white font-mono text-sm"
                  />
                  <Button
                    onClick={() => copyToClipboard(selectedAsset.address)}
                    className={`px-3 ${copied ? "bg-green-600 hover:bg-green-700" : "bg-purple-600 hover:bg-purple-700"} glow-purple`}
                  >
                    {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                {copied && (
                  <p className="text-green-400 text-sm flex items-center">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Address copied to clipboard!
                  </p>
                )}
              </div>

              {/* Network Warning */}
              <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
                  <div>
                    <div className="text-yellow-400 font-semibold text-sm">Important</div>
                    <div className="text-yellow-300 text-sm">
                      Only send {selectedAsset.name} to this address on the {selectedAsset.network} network. Sending
                      other assets or using wrong network will result in permanent loss.
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div>
          {/* Deposit Instructions */}
          <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
            <h3 className="font-heading font-semibold text-white text-lg mb-4">Instructions</h3>
            <div className="space-y-4 text-sm text-slate-300">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold mt-0.5">
                  1
                </div>
                <div>
                  <div className="font-semibold text-white">Copy the deposit address</div>
                  <div className="text-slate-400">Use the copy button or scan the QR code</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold mt-0.5">
                  2
                </div>
                <div>
                  <div className="font-semibold text-white">Send from your wallet</div>
                  <div className="text-slate-400">Transfer {selectedAsset.name} from your external wallet</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold mt-0.5">
                  3
                </div>
                <div>
                  <div className="font-semibold text-white">Wait for confirmations</div>
                  <div className="text-slate-400">
                    Your deposit will appear after {selectedAsset.confirmations} network confirmations
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
