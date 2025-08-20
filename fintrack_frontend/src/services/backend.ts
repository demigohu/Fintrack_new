"use client"

import { AuthClient } from "@dfinity/auth-client"
import { type ActorSubclass } from "@dfinity/agent"
import { Principal } from "@dfinity/principal"
import { getBackendActor } from "@/lib/ic"
import type { _SERVICE } from "../../../src/declarations/fintrack_backend/fintrack_backend.did"

type Result<T> = { success: true; data: T } | { success: false; error: string }

let authClient: AuthClient | null = null
let actor: ActorSubclass<_SERVICE> | null = null

const network = process.env.NEXT_PUBLIC_DFX_NETWORK || "local"
const identityProvider = network === "ic"
  ? "https://identity.ic0.app"
  : `http://${process.env.NEXT_PUBLIC_CANISTER_ID_INTERNET_IDENTITY}.localhost:4943`

async function ensureAuthClient(): Promise<AuthClient> {
  if (!authClient) {
    authClient = await AuthClient.create()
  }
  return authClient
}

async function ensureActor(): Promise<ActorSubclass<_SERVICE>> {
  if (actor) return actor
  const client = await ensureAuthClient()
  const identity = client.getIdentity()
  actor = await getBackendActor(identity)
  return actor
}

export const authService = {
  init: async (): Promise<boolean> => {
    const client = await ensureAuthClient()
    const isAuth = await client.isAuthenticated()
    // always rebuild actor so it carries identity if present
    actor = await getBackendActor(client.getIdentity())
    return isAuth
  },
  login: async () => {
    const client = await ensureAuthClient()
    await client.login({ identityProvider })
    actor = await getBackendActor(client.getIdentity())
  },
  logout: async () => {
    const client = await ensureAuthClient()
    await client.logout()
    actor = await getBackendActor(undefined)
  },
  isAuthenticated: async (): Promise<boolean> => {
    const client = await ensureAuthClient()
    return client.isAuthenticated()
  },
  getCurrentUser: async (): Promise<string | null> => {
    const client = await ensureAuthClient()
    const identity = client.getIdentity()
    // principal may be anonymous if not authed
    return identity ? identity.getPrincipal().toText() : null
  },
}

// Transactions subset based on candid; adapt as your backend evolves
export const transactionService = {
  addTransaction: async (
    _amount: number,
    _currency: string,
    _description: string,
    _isIncome: boolean,
    _category: string
  ): Promise<Result<null>> => {
    return { success: false, error: "Not implemented on backend" }
  },
  getTransactions: async (): Promise<Result<any[]>> => {
    try {
      const a = await ensureActor()
      // The backend requires a Principal; use the authenticated principal
      const client = await ensureAuthClient()
      const principal = client.getIdentity().getPrincipal()
      // Fix: pass principal and opt nat32 correctly
      const res = await a.get_transaction_history(principal, [], [])
      if ("Ok" in res) return { success: true, data: res.Ok }
      return { success: false, error: res.Err }
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to fetch transactions" }
    }
  },
  getTransactionCount: async (): Promise<Result<number>> => {
    try {
      const a = await ensureActor()
      const client = await ensureAuthClient()
      const principal = client.getIdentity().getPrincipal()
      const count = await a.get_transaction_count(principal)
      return { success: true, data: count }
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to get count" }
    }
  },
  getTransactionsBySource: async (_source: string): Promise<Result<any[]>> => {
    return { success: false, error: "Not implemented on backend" }
  },
  getTransactionsByPeriod: async (_yearMonth: string): Promise<Result<any[]>> => {
    return { success: false, error: "Not implemented on backend" }
  },
  syncBlockchainTransactions: async (): Promise<Result<null>> => {
    return { success: false, error: "Not implemented on backend" }
  },
}

export const bitcoinService = {
  getBtcBalance: async (): Promise<Result<bigint>> => {
    try {
      const a = await ensureActor()
      const client = await ensureAuthClient()
      const principal = client.getIdentity().getPrincipal()
      // Fix: pass opt principal and opt vec nat8 correctly
      const res = await a.btc_get_balance([principal], [])
      if ("Ok" in res) return { success: true, data: res.Ok }
      return { success: false, error: res.Err }
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to get BTC balance" }
    }
  },
  
  getBtcDepositAddress: async (): Promise<Result<string>> => {
    try {
      const a = await ensureActor()
      const client = await ensureAuthClient()
      const principal = client.getIdentity().getPrincipal()
      // Fix: pass opt principal and opt vec nat8 correctly
      const res = await a.btc_get_deposit_address([principal], [])
      if ("Ok" in res) return { success: true, data: res.Ok }
      return { success: false, error: res.Err }
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to get BTC deposit address" }
    }
  },
  
  // Refresh BTC balance by updating UTXOs (mint to ckBTC)
  refreshBtcBalance: async (): Promise<Result<null>> => {
    try {
      const a = await ensureActor()
      const client = await ensureAuthClient()
      const principal = client.getIdentity().getPrincipal()
      const res = await a.btc_refresh_balance([principal], [])
      if ("Ok" in res) return { success: true, data: null }
      return { success: false, error: res.Err }
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to refresh BTC balance" }
    }
  },
  
  // Approve BTC withdrawal using ckBTC ledger canister
  approveBtcWithdrawal: async (amount: bigint, subaccount?: Uint8Array): Promise<Result<null>> => {
    try {
      const client = await ensureAuthClient()
      const identity = client.getIdentity()
      
      // Get ckBTC ledger canister ID from environment
      const ckbtcLedgerCanisterId = process.env.NEXT_PUBLIC_CANISTER_ID_CKBTC_LEDGER || "mc6ru-gyaaa-aaaar-qaaaq-cai"
      const ckbtcMinterCanisterId = process.env.NEXT_PUBLIC_CANISTER_ID_CKBTC_MINTER || "ml52i-qqaaa-aaaar-qaaba-cai"
      
      // Create HttpAgent with authenticated identity
      const { HttpAgent } = await import("@dfinity/agent")
      const agent = new HttpAgent({ 
        identity,
        host: process.env.NEXT_PUBLIC_IC_HOST || "http://127.0.0.1:4943"
      })
      
      // Fetch root key for local development
      if (process.env.NEXT_PUBLIC_DFX_NETWORK !== "ic") {
        try {
          await agent.fetchRootKey()
        } catch (e) {
          console.warn("Unable to fetch root key. Is local replica running?", e)
        }
      }
      
      // Create actor for ckBTC ledger
      const { Actor } = await import("@dfinity/agent")
      const { idlFactory: ckbtcLedgerIdlFactory } = await import("../../../src/declarations/ckbtc_ledger")
      
      const ckbtcLedgerActor = Actor.createActor(ckbtcLedgerIdlFactory, {
        agent,
        canisterId: ckbtcLedgerCanisterId,
      })
      
      // Fetch ledger transfer fee to use for approval (ICRC-1 fee)
      let ledgerFee: bigint | null = null
      try {
        ledgerFee = await ckbtcLedgerActor.icrc1_fee() as bigint
      } catch (e) {
        // fallback to let ledger decide if fee not retrievable
      }

      // Call icrc2_approve on ckBTC ledger
      const approveResult = await ckbtcLedgerActor.icrc2_approve({
        spender: {
          owner: Principal.fromText(ckbtcMinterCanisterId),
          subaccount: subaccount ? [subaccount] : []
        },
        amount: amount,
        from_subaccount: subaccount ? [subaccount] : [],
        expected_allowance: [],
        expires_at: [],
        fee: ledgerFee !== null ? [ledgerFee] : [],
        memo: [],
        created_at_time: []
      }) as { Ok: bigint } | { Err: any }
      
      if ("Ok" in approveResult) {
        return { success: true, data: null }
      } else {
        return { success: false, error: `Approval failed: ${approveResult.Err}` }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to approve BTC withdrawal" }
    }
  },
  
  // Withdraw BTC using ckBTC minter canister
  withdrawBtc: async (address: string, amount: bigint, subaccount?: Uint8Array): Promise<Result<string>> => {
    try {
      const client = await ensureAuthClient()
      const identity = client.getIdentity()
      
      // Get ckBTC minter canister ID from environment
      const ckbtcMinterCanisterId = process.env.NEXT_PUBLIC_CANISTER_ID_CKBTC_MINTER || "ml52i-qqaaa-aaaar-qaaba-cai"
      
      // Create HttpAgent with authenticated identity
      const { HttpAgent } = await import("@dfinity/agent")
      const agent = new HttpAgent({ 
        identity,
        host: process.env.NEXT_PUBLIC_IC_HOST || "http://127.0.0.1:4943"
      })
      
      // Fetch root key for local development
      if (process.env.NEXT_PUBLIC_DFX_NETWORK !== "ic") {
        try {
          await agent.fetchRootKey()
        } catch (e) {
          console.warn("Unable to fetch root key. Is local replica running?", e)
        }
      }
      
      // Create actor for ckBTC minter
      const { Actor } = await import("@dfinity/agent")
      const { idlFactory: ckbtcMinterIdlFactory } = await import("../../../src/declarations/ckbtc_minter")
      
      const ckbtcMinterActor = Actor.createActor(ckbtcMinterIdlFactory, {
        agent,
        canisterId: ckbtcMinterCanisterId,
      })
      
      // Call retrieve_btc_with_approval on ckBTC minter
      const withdrawResult = await ckbtcMinterActor.retrieve_btc_with_approval({
        address: address,
        amount: amount,
        from_subaccount: subaccount ? [subaccount] : []
      }) as { Ok: { block_index: bigint } } | { Err: any }
      
      if ("Ok" in withdrawResult) {
        return { success: true, data: withdrawResult.Ok.block_index.toString() }
      } else {
        return { success: false, error: `Withdrawal failed: ${withdrawResult.Err}` }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to withdraw BTC" }
    }
  },
  
  // Get BTC withdrawal fee
  getBtcWithdrawalFee: async (): Promise<Result<bigint>> => {
    try {
      const a = await ensureActor()
      const res = await a.btc_get_current_fee_percentiles()
      if ("Ok" in res) {
        // Use 50th percentile (median) fee for withdrawal
        const fees = res.Ok
        if (fees.length > 0) {
          const medianFee = fees[Math.floor(fees.length / 2)]
          // Convert millisatoshi/byte to satoshi (assuming average tx size ~250 bytes)
          const estimatedFee = BigInt(medianFee) * BigInt(250) / BigInt(1000)
          return { success: true, data: estimatedFee }
        }
      }
      // Fallback to default fee if no fee data available
      return { success: true, data: BigInt(10000) } // Default fee: 0.0001 BTC
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to get BTC withdrawal fee" }
    }
  }
}

export const ethereumService = {
  getEthBalance: async (): Promise<Result<bigint>> => {
    try {
      const a = await ensureActor()
      const client = await ensureAuthClient()
      const principal = client.getIdentity().getPrincipal()
      // Fix: pass opt principal and opt vec nat8 correctly
      const res = await a.eth_get_balance([principal], [])
      if ("Ok" in res) return { success: true, data: res.Ok }
      return { success: false, error: res.Err }
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to get ETH balance" }
    }
  },
  
  getEthDepositAddress: async (): Promise<Result<string>> => {
    try {
      const a = await ensureActor()
      // Fix: eth_get_deposit_address only takes opt vec nat8 (no principal)
      const res = await a.eth_get_deposit_address([])
      if ("Ok" in res) return { success: true, data: res.Ok }
      return { success: false, error: res.Err }
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to get ETH deposit address" }
    }
  },
  
  estimateWithdrawalFee: async (): Promise<Result<string>> => {
    try {
      const a = await ensureActor()
      const res = await a.eth_estimate_withdrawal_fee()
      if ("Ok" in res) return { success: true, data: res.Ok }
      return { success: false, error: res.Err }
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to estimate withdrawal fee" }
    }
  },
  
  // Approve ckETH withdrawal using ckETH ledger canister
  approveCkethWithdrawal: async (amount: bigint, subaccount?: Uint8Array): Promise<Result<null>> => {
    try {
      const client = await ensureAuthClient()
      const identity = client.getIdentity()
      
      // Get ckETH ledger and minter canister IDs from environment
      const ckethLedgerCanisterId = process.env.NEXT_PUBLIC_CANISTER_ID_CKETH_LEDGER || "apia6-jaaaa-aaaar-qabma-cai"
      const ckethMinterCanisterId = process.env.NEXT_PUBLIC_CANISTER_ID_CKETH_MINTER || "jzenf-aiaaa-aaaar-qaa7q-cai"
      
      // Create HttpAgent with authenticated identity
      const { HttpAgent } = await import("@dfinity/agent")
      const agent = new HttpAgent({ 
        identity,
        host: process.env.NEXT_PUBLIC_IC_HOST || "http://127.0.0.1:4943"
      })
      
      // Fetch root key for local development
      if (process.env.NEXT_PUBLIC_DFX_NETWORK !== "ic") {
        try {
          await agent.fetchRootKey()
        } catch (e) {
          console.warn("Unable to fetch root key. Is local replica running?", e)
        }
      }
      
      // Create actor for ckETH ledger
      const { Actor } = await import("@dfinity/agent")
      const { idlFactory: ckethLedgerIdlFactory } = await import("../../../src/declarations/cketh_ledger")
      
      const ckethLedgerActor = Actor.createActor(ckethLedgerIdlFactory, {
        agent,
        canisterId: ckethLedgerCanisterId,
      })
      
      // Call icrc2_approve on ckETH ledger
      const approveResult = await ckethLedgerActor.icrc2_approve({
        spender: {
          owner: Principal.fromText(ckethMinterCanisterId),
        subaccount: subaccount ? [subaccount] : []
        },
        amount: amount,
        from_subaccount: subaccount ? [subaccount] : [],
        expected_allowance: [],
        expires_at: [],
        fee: [],
        memo: [],
        created_at_time: []
      }) as { Ok: bigint } | { Err: any }
      
      if ("Ok" in approveResult) {
        return { success: true, data: null }
      } else {
        return { success: false, error: `Approval failed: ${approveResult.Err}` }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to approve ckETH withdrawal" }
    }
  },
  
  // Withdraw ckETH using ckETH minter canister
  withdrawCketh: async (address: string, amount: bigint, subaccount?: Uint8Array): Promise<Result<string>> => {
    try {
      const client = await ensureAuthClient()
      const identity = client.getIdentity()
      
      // Get ckETH minter canister ID from environment
      const ckethMinterCanisterId = process.env.NEXT_PUBLIC_CANISTER_ID_CKETH_MINTER || "jzenf-aiaaa-aaaar-qaa7q-cai"
      
      // Create HttpAgent with authenticated identity
      const { HttpAgent } = await import("@dfinity/agent")
      const agent = new HttpAgent({ 
        identity,
        host: process.env.NEXT_PUBLIC_IC_HOST || "http://127.0.0.1:4943"
      })
      
      // Fetch root key for local development
      if (process.env.NEXT_PUBLIC_DFX_NETWORK !== "ic") {
        try {
          await agent.fetchRootKey()
        } catch (e) {
          console.warn("Unable to fetch root key. Is local replica running?", e)
        }
      }
      
      // Create actor for ckETH minter
      const { Actor } = await import("@dfinity/agent")
      const { idlFactory: ckethMinterIdlFactory } = await import("../../../src/declarations/cketh_minter")
      
      const ckethMinterActor = Actor.createActor(ckethMinterIdlFactory, {
        agent,
        canisterId: ckethMinterCanisterId,
      })
      
      // Call withdraw_eth on ckETH minter
      const withdrawResult = await ckethMinterActor.withdraw_eth({
        amount: amount,
        recipient: address,
        from_subaccount: subaccount ? [subaccount] : []
      }) as { Ok: any } | { Err: any }
      
      if ("Ok" in withdrawResult) {
        return { success: true, data: "Withdrawal request submitted successfully" }
      } else {
        return { success: false, error: `Withdrawal failed: ${withdrawResult.Err}` }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to withdraw ckETH" }
    }
  },
  
  // Get ckETH withdrawal fee
  getCkethWithdrawalFee: async (): Promise<Result<bigint>> => {
    try {
      const a = await ensureActor()
      const res = await a.eth_fee_history()
      if ("Ok" in res) {
        // Parse fee history response and extract gas price
        try {
          const feeData = JSON.parse(res.Ok)
          if (feeData.baseFeePerGas && feeData.baseFeePerGas.length > 0) {
            // Use the latest base fee and add priority fee (tip)
            const latestBaseFee = BigInt(feeData.baseFeePerGas[0])
            const priorityFee = BigInt(2000000000) // 2 gwei tip
            const estimatedGasPrice = latestBaseFee + priorityFee
            // Assume withdrawal uses ~21000 gas
            const estimatedFee = estimatedGasPrice * BigInt(21000)
            return { success: true, data: estimatedFee }
          }
        } catch (parseError) {
          console.warn("Failed to parse fee history:", parseError)
        }
      }
      // Fallback to default fee if no fee data available
      return { success: true, data: BigInt(1000000000000000) } // Default fee: 0.001 ETH (in wei)
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to get ckETH withdrawal fee" }
    }
  }
}

export const balanceService = {
  getPortfolioSummary: async (): Promise<Result<any>> => {
    try {
      const a = await ensureActor()
      const client = await ensureAuthClient()
      const principal = client.getIdentity().getPrincipal()
      const res = await a.get_user_balances(principal)
      if ("Ok" in res) return { success: true, data: res.Ok }
      return { success: false, error: res.Err }
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to get balances" }
    }
  },
}

export const currencyService = {
  getCurrencyRates: async (): Promise<Result<{ btc_to_usd: number; eth_to_usd: number; sol_to_usd: number; last_updated: number }>> => {
    try {
      const a = await ensureActor()
      const res = await a.get_rates_summary()
      if ("Ok" in res) return { success: true, data: res.Ok as any }
      return { success: false, error: res.Err }
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to get rates" }
    }
  },
  fetchRealTimeRates: async (): Promise<Result<any>> => {
    return { success: false, error: "Not implemented on backend" }
  },
}


