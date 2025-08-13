"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { History, ArrowUpRight, ArrowDownLeft, ArrowRightLeft } from "lucide-react"

const transactions = [
  {
    type: "buy",
    asset: "BTC",
    amount: "0.125",
    price: "$43,250.00",
    total: "$5,406.25",
    time: "2 hours ago",
    status: "completed",
  },
  {
    type: "sell",
    asset: "ETH",
    amount: "2.5",
    price: "$2,680.50",
    total: "$6,701.25",
    time: "5 hours ago",
    status: "completed",
  },
  {
    type: "swap",
    asset: "SOL → ADA",
    amount: "50 → 2,500",
    price: "$98.75 → $0.45",
    total: "$4,937.50",
    time: "1 day ago",
    status: "completed",
  },
  {
    type: "buy",
    asset: "DOT",
    amount: "500",
    price: "$5.998",
    total: "$2,999.00",
    time: "2 days ago",
    status: "completed",
  },
  {
    type: "deposit",
    asset: "USDT",
    amount: "10,000",
    price: "$1.00",
    total: "$10,000.00",
    time: "3 days ago",
    status: "completed",
  },
]

const getTransactionIcon = (type: string) => {
  switch (type) {
    case "buy":
      return <ArrowDownLeft className="h-4 w-4 text-green-400" />
    case "sell":
      return <ArrowUpRight className="h-4 w-4 text-red-400" />
    case "swap":
      return <ArrowRightLeft className="h-4 w-4 text-cyan-400" />
    case "deposit":
      return <ArrowDownLeft className="h-4 w-4 text-blue-400" />
    default:
      return <ArrowUpRight className="h-4 w-4 text-slate-400" />
  }
}

const getTransactionColor = (type: string) => {
  switch (type) {
    case "buy":
    case "deposit":
      return "text-green-400"
    case "sell":
      return "text-red-400"
    case "swap":
      return "text-cyan-400"
    default:
      return "text-slate-400"
  }
}

export function TransactionHistory() {
  return (
    <Card className="p-6 bg-slate-900/80 border-purple-500/20 glow-purple">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <History className="h-5 w-5 text-purple-400" />
          <h3 className="font-heading font-semibold text-white text-lg">Recent Transactions</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10 bg-transparent"
        >
          View All
        </Button>
      </div>

      <div className="space-y-3">
        {transactions.map((tx, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 hover:bg-slate-800/50 rounded-lg transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-slate-800/50 group-hover:bg-slate-700/50 transition-colors">
                {getTransactionIcon(tx.type)}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className={`font-semibold text-sm capitalize ${getTransactionColor(tx.type)}`}>{tx.type}</span>
                  <span className="text-white font-semibold text-sm">{tx.asset}</span>
                </div>
                <div className="text-slate-400 text-xs">{tx.time}</div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-white font-semibold text-sm">{tx.total}</div>
              <div className="text-slate-400 text-xs">
                {tx.amount} @ {tx.price}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
