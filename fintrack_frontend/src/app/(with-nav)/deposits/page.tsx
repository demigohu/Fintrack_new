"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, QrCode, CheckCircle, AlertTriangle, RefreshCw, Coins, Send } from "lucide-react"
import { bitcoinService, ethereumService } from "@/services/backend"
import { useRefreshBtcBalance, useEthDeposit } from "@/hooks/useData"
import { useAuth } from "@/contexts/AuthContext"

// Component untuk preview principal bytes32
function PrincipalPreview({ principal }: { principal: string }) {
  const [bytes32, setBytes32] = useState<string>("Loading...")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function convertPrincipal() {
      try {
        const { getBackendActor } = await import('../../../lib/ic')
        const actor = await getBackendActor()
        const result = await actor.principal_to_bytes32(principal)
        
        if ('Ok' in result) {
          setBytes32(result.Ok)
        } else {
          setError(result.Err || 'Failed to convert principal')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }

    convertPrincipal()
  }, [principal])

  if (error) {
    return <span className="text-red-400">Error: {error}</span>
  }

  return <span>{bytes32}</span>
}

const cryptoAssets = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    network: "Bitcoin",
    ckAddress: "",
    nativeAddress: "",
    minDeposit: "0.0001",
    confirmations: 3,
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    network: "Ethereum (ERC-20)",
    ckAddress: "",
    nativeAddress: "",
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Hook untuk refresh BTC balance (mint ke ckBTC)
  const { refreshing, error: refreshError, success: refreshSuccess, refreshBalance } = useRefreshBtcBalance()
  
  // Hook untuk ETH deposit
  const { user } = useAuth()
  const { depositing, error: depositError, success: depositSuccess, transactionHash, depositEth, resetDeposit, principalBytes32 } = useEthDeposit()

  useEffect(() => {
    const loadAddresses = async () => {
      setLoading(true)
      setError(null)
      try {
        // ckAsset deposit addresses
        const btcCk = await bitcoinService.getBtcDepositAddress()
        const ethCk = await ethereumService.getEthDepositAddress()

        if (btcCk.success) {
          cryptoAssets[0].ckAddress = btcCk.data
        } else {
          console.error("BTC ck address error:", btcCk.error)
          cryptoAssets[0].ckAddress = "Address unavailable"
        }

        if (ethCk.success) {
          cryptoAssets[1].ckAddress = ethCk.data
        } else {
          console.error("ETH ck address error:", ethCk.error)
          cryptoAssets[1].ckAddress = "Address unavailable"
        }

        // native addresses derived via backend
        const btcNat = await bitcoinService.deriveBtcAddress()
        const ethNat = await ethereumService.deriveEthAddress()

        if (btcNat.success) {
          cryptoAssets[0].nativeAddress = btcNat.data
        } else {
          console.error("BTC native address error:", btcNat.error)
          cryptoAssets[0].nativeAddress = "Address unavailable"
        }

        if (ethNat.success) {
          cryptoAssets[1].nativeAddress = ethNat.data
        } else {
          console.error("ETH native address error:", ethNat.error)
          cryptoAssets[1].nativeAddress = "Address unavailable"
        }

        // Force refresh selected asset object
        setSelectedAsset({ ...cryptoAssets.find(a => a.symbol === selectedAsset.symbol)! })
      } catch (e: any) {
        setError(e?.message || "Failed to load deposit addresses")
        // Set fallback addresses
        cryptoAssets[0].address = "Address unavailable"
        cryptoAssets[1].address = "Address unavailable"
      } finally {
        setLoading(false)
      }
    }

    loadAddresses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

                {/* Principal Bytes32 Preview - Only show for ETH */}
                {selectedAsset.symbol === "ETH" && user && customAmount && (
                  <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                    <div className="text-slate-300 text-xs font-medium mb-2">Principal Bytes32 Preview:</div>
                    <div className="text-white text-xs font-mono break-all bg-slate-900/50 p-2 rounded border border-slate-600">
                      <PrincipalPreview principal={user} />
                    </div>
                    <div className="text-slate-400 text-xs mt-2">
                      Principal converted using official ICP method (backend)
                    </div>
                  </div>
                )}
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
              <div className="space-y-5">
                {/* ckAsset deposit (minter) */}
                <div className="space-y-2">
                  <Label className="text-slate-300">ck{selectedAsset.symbol} Deposit Address (Minter)</Label>
                  <div className="text-xs text-slate-400">Network: {selectedAsset.symbol === "BTC" ? "Internet Computer / ckBTC" : "Internet Computer / ckETH"}</div>
                  <div className="flex items-center space-x-2">
                    <Input
                      value={(selectedAsset as any).ckAddress || (loading ? "Loading..." : error ? "Unavailable" : "")}
                      readOnly
                      placeholder={loading ? "Loading..." : error ? "Unavailable" : ""}
                      className="bg-slate-800/50 border-slate-600 text-white font-mono text-sm"
                    />
                    <Button
                      onClick={() => (selectedAsset as any).ckAddress && copyToClipboard((selectedAsset as any).ckAddress)}
                      className={`px-3 ${copied ? "bg-green-600 hover:bg-green-700" : "bg-purple-600 hover:bg-purple-700"} glow-purple`}
                      disabled={!(selectedAsset as any).ckAddress}
                    >
                      {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Native deposit */}
                <div className="space-y-2">
                  <Label className="text-slate-300">Native {selectedAsset.symbol} Deposit Address</Label>
                  <div className="text-xs text-slate-400">Network: {selectedAsset.symbol === "BTC" ? "Bitcoin (native)" : "Ethereum (native)"}</div>
                  <div className="flex items-center space-x-2">
                    <Input
                      value={(selectedAsset as any).nativeAddress || (loading ? "Loading..." : error ? "Unavailable" : "")}
                      readOnly
                      placeholder={loading ? "Loading..." : error ? "Unavailable" : ""}
                      className="bg-slate-800/50 border-slate-600 text-white font-mono text-sm"
                    />
                    <Button
                      onClick={() => (selectedAsset as any).nativeAddress && copyToClipboard((selectedAsset as any).nativeAddress)}
                      className={`px-3 ${copied ? "bg-green-600 hover:bg-green-700" : "bg-purple-600 hover:bg-purple-700"} glow-purple`}
                      disabled={!(selectedAsset as any).nativeAddress}
                    >
                      {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {error && (
                  <p className="text-red-400 text-sm">
                    {error}
                  </p>
                )}
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
                    <div className="text-yellow-300 text-sm space-y-1">
                      <div>• Send to the correct address type: ckAsset vs Native.</div>
                      <div>• ckAsset (minter) address is for minting ck{selectedAsset.symbol} on Internet Computer.</div>
                      <div>• Native address is for on-chain {selectedAsset.symbol} on its original network.</div>
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

        {/* BTC Mint Section - Only show for BTC */}
        {selectedAsset.symbol === "BTC" && selectedAsset.address && selectedAsset.address !== "Address unavailable" && (
          <div className="mt-6">
            <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-semibold text-white text-lg">Mint BTC to ckBTC</h3>
                <Button
                  onClick={refreshBalance}
                  disabled={refreshing}
                  className="bg-purple-600 hover:bg-purple-700 glow-purple"
                >
                  {refreshing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Minting...
                    </>
                  ) : (
                    <>
                      <Coins className="h-4 w-4 mr-2" />
                      Mint to ckBTC
                    </>
                  )}
                </Button>
              </div>

              {/* Status Messages */}
              {refreshSuccess && (
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center text-green-400 text-sm">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Successfully minted BTC to ckBTC!
                  </div>
                </div>
              )}

              {refreshError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center text-red-400 text-sm">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Error: {refreshError}
                  </div>
                </div>
              )}

              {/* Info about minting */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="text-blue-400 text-xs">
                  <div className="font-medium mb-1">How it works:</div>
                  <div>1. Send BTC to the address above</div>
                  <div>2. Wait for network confirmations</div>
                  <div>3. Click &quot;Mint to ckBTC&quot; to convert your BTC to ckBTC tokens</div>
                  <div>4. Your ckBTC balance will be updated automatically</div>
                  <div className="mt-2 text-blue-300">
                    <strong>Note:</strong> The mint button will check for new UTXOs and mint them to ckBTC automatically.
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ETH Deposit Section - Only show for ETH */}
        {selectedAsset.symbol === "ETH" && selectedAsset.ckAddress && selectedAsset.ckAddress !== "Address unavailable" && (
          <div className="mt-6">
            <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-semibold text-white text-lg">Deposit ETH to ckETH</h3>
                <Button
                  onClick={() => {
                    if (customAmount && customAmount !== "" && user) {
                      depositEth(customAmount, selectedAsset.ckAddress)
                    }
                  }}
                  disabled={depositing || !customAmount || customAmount === "" || !user}
                  className="bg-purple-600 hover:bg-purple-700 glow-purple"
                >
                  {depositing ? (
                    <>
                      <Send className="h-4 w-4 mr-2 animate-spin" />
                      Depositing...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Deposit ETH
                    </>
                  )}
                </Button>
              </div>

              {/* Principal Information */}
              {user && (
                <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="text-slate-300 text-sm font-medium mb-2">Your Principal:</div>
                  <div className="text-white text-xs font-mono break-all mb-2">{user}</div>
                  <div className="text-slate-400 text-xs">
                    This principal will be converted to bytes32 and sent to the helper contract
                  </div>
                </div>
              )}

              {/* Status Messages */}
              {depositSuccess && (
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center text-green-400 text-sm">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    ETH deposit successful!
                  </div>
                  {transactionHash && (
                    <div className="mt-2 text-xs text-green-300">
                      Transaction Hash: {transactionHash}
                    </div>
                  )}
                  {principalBytes32 && (
                    <div className="mt-2 text-xs text-green-300">
                      Principal Bytes32: {principalBytes32}
                    </div>
                  )}
                </div>
              )}

              {depositError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center text-red-400 text-sm">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Error: {depositError}
                  </div>
                </div>
              )}

              {/* Info about ETH deposit */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="text-blue-400 text-xs">
                  <div className="font-medium mb-1">How ETH deposit works:</div>
                  <div>1. Enter the amount of ETH you want to deposit</div>
                  <div>2. Your principal is converted to bytes32 format</div>
                  <div>3. Click &quot;Deposit ETH&quot; to send to helper contract</div>
                  <div>4. Confirm transaction in MetaMask</div>
                  <div>5. Helper contract receives your ETH + principal</div>
                  <div>6. Minter automatically detects and mints ckETH</div>
                  <div className="mt-2 text-blue-300">
                    <strong>Note:</strong> ETH deposits are processed automatically by the minter after confirmation.
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
