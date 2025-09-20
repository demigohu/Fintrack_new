import { Principal } from "@dfinity/principal"
import { getAgent } from "@/lib/ic"
import { Actor } from "@dfinity/agent"
import { authService } from "@/services/backend"

// ICRC1 Transfer Interface
export interface ICRC1TransferArgs {
  to: {
    owner: Principal;
    subaccount?: Uint8Array | null;
  };
  amount: bigint;
  fee?: bigint | null;
  memo?: Uint8Array | null;
  created_at_time?: bigint | null;
  from_subaccount?: Uint8Array | null;
}

export interface ICRC1TransferResult {
  Ok?: bigint; // Block index
  Err?: {
    [key: string]: any;
  };
}

// Token Canister Addresses
export const TOKEN_CANISTERS = {
  ckBTC: "mc6ru-gyaaa-aaaar-qaaaq-cai",
  ckETH: "apia6-jaaaa-aaaar-qabma-cai",
} as const

// KongSwap Canister Address
export const KONGSWAP_CANISTER = "2ipq2-uqaaa-aaaar-qailq-cai"

// Create ICRC1 Actor using direct agent creation
export const createICRC1Actor = async (canisterId: string, identity?: any) => {
  const agent = await getAgent(identity)
  
  // Create actor with ICRC1 interface
  return Actor.createActor(
    // ICRC1 Interface
    ({ IDL }) => {
      const Account = IDL.Record({
        owner: IDL.Principal,
        subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
      })
      
      const TransferArgs = IDL.Record({
        to: Account,
        amount: IDL.Nat,
        fee: IDL.Opt(IDL.Nat),
        memo: IDL.Opt(IDL.Vec(IDL.Nat8)),
        created_at_time: IDL.Opt(IDL.Nat64),
        from_subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
      })
      
      const TransferResult = IDL.Variant({
        Ok: IDL.Nat,
        Err: IDL.Text,
      })
      
      return IDL.Service({
        icrc1_transfer: IDL.Func([TransferArgs], [TransferResult], []),
        icrc1_balance_of: IDL.Func([Account], [IDL.Nat], ["query"]),
        icrc1_total_supply: IDL.Func([], [IDL.Nat], ["query"]),
        icrc1_metadata: IDL.Func([], [IDL.Vec(IDL.Tuple(IDL.Text, IDL.Variant({ Nat: IDL.Nat, Int: IDL.Int, Text: IDL.Text, Blob: IDL.Vec(IDL.Nat8) })))], ["query"]),
        icrc1_name: IDL.Func([], [IDL.Text], ["query"]),
        icrc1_symbol: IDL.Func([], [IDL.Text], ["query"]),
        icrc1_decimals: IDL.Func([], [IDL.Nat8], ["query"]),
        icrc1_fee: IDL.Func([], [IDL.Nat], ["query"]),
      })
    },
    {
      agent,
      canisterId,
    }
  )
}

// Helper function to get authenticated identity
const getAuthenticatedIdentity = async () => {
  try {
    const isAuthenticated = await authService.isAuthenticated()
    if (!isAuthenticated) return undefined
    
    // Get the identity from the auth client
    const { AuthClient } = await import("@dfinity/auth-client")
    const client = await AuthClient.create()
    return client.getIdentity()
  } catch (error) {
    console.warn("Failed to get authenticated identity:", error)
    return undefined
  }
}

// Transfer ICRC1 Token
export const transferICRC1Token = async (
  tokenSymbol: keyof typeof TOKEN_CANISTERS,
  args: ICRC1TransferArgs,
  identity?: any
): Promise<ICRC1TransferResult> => {
  const canisterId = TOKEN_CANISTERS[tokenSymbol]
  // Use authenticated identity if none provided
  const finalIdentity = identity || await getAuthenticatedIdentity()
  const actor = await createICRC1Actor(canisterId, finalIdentity)
  
  const transferArgs = {
    to: {
      owner: args.to.owner,
      subaccount: args.to.subaccount ? [Array.from(args.to.subaccount)] : [],
    },
    amount: args.amount,
    fee: args.fee ? [args.fee] : [],
    memo: args.memo ? [Array.from(args.memo)] : [],
    created_at_time: args.created_at_time ? [args.created_at_time] : [],
    from_subaccount: args.from_subaccount ? [Array.from(args.from_subaccount)] : [],
  }
  
  return await actor.icrc1_transfer(transferArgs) as ICRC1TransferResult
}

// Get Token Balance
export const getICRC1Balance = async (
  tokenSymbol: keyof typeof TOKEN_CANISTERS,
  account: {
    owner: Principal;
    subaccount?: Uint8Array | null;
  },
  identity?: any
): Promise<bigint> => {
  const canisterId = TOKEN_CANISTERS[tokenSymbol]
  // Use authenticated identity if none provided
  const finalIdentity = identity || await getAuthenticatedIdentity()
  const actor = await createICRC1Actor(canisterId, finalIdentity)
  
  const accountArgs = {
    owner: account.owner,
    subaccount: account.subaccount ? [Array.from(account.subaccount)] : [],
  }
  
  return await actor.icrc1_balance_of(accountArgs) as bigint
}

// Get Token Metadata
export const getICRC1Metadata = async (tokenSymbol: keyof typeof TOKEN_CANISTERS, identity?: any) => {
  const canisterId = TOKEN_CANISTERS[tokenSymbol]
  // Use authenticated identity if none provided
  const finalIdentity = identity || await getAuthenticatedIdentity()
  const actor = await createICRC1Actor(canisterId, finalIdentity)
  
  const [name, symbol, decimals, fee] = await Promise.all([
    actor.icrc1_name(),
    actor.icrc1_symbol(),
    actor.icrc1_decimals(),
    actor.icrc1_fee(),
  ])
  
  return { name, symbol, decimals, fee }
}