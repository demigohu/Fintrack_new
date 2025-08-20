"use client"

import { HttpAgent, type Identity } from "@dfinity/agent"

// Import generated declarations from the workspace root.
// Note: We enable externalDir in next.config.ts to allow this import.
import { createActor as createBackendActor, canisterId as generatedBackendCanisterId } from "../../../src/declarations/fintrack_backend"

type Optional<T> = [] | [T]

export const getIcHost = (): string | undefined => {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_IC_HOST
  if (process.env.NEXT_PUBLIC_DFX_NETWORK === "ic") return undefined
  return process.env.NEXT_PUBLIC_IC_HOST || "http://127.0.0.1:4943"
}

export const getBackendCanisterId = (): string | undefined => {
  return (
    process.env.NEXT_PUBLIC_CANISTER_ID_FINTRACK_BACKEND ||
    generatedBackendCanisterId
  )
}

export const getBackendActor = async (identity?: Identity) => {
  const canisterId = getBackendCanisterId()
  if (!canisterId) throw new Error("FINTRACK_BACKEND canister id is not set")

  const host = getIcHost()
  const agent = new HttpAgent({ host, identity })

  if (process.env.NEXT_PUBLIC_DFX_NETWORK !== "ic") {
    try {
      await agent.fetchRootKey()
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Unable to fetch root key. Is local replica running at", host, e)
    }
  }

  return createBackendActor(canisterId, { agent })
}

// Helper to wrap candid Opt parameters
export const none = <T,>(): Optional<T> => []
export const some = <T,>(val: T): Optional<T> => [val]


