import type { NextConfig } from "next";
import dotenv from "dotenv"

// Load canister IDs from repo root .env so the frontend can reach the backend canister
dotenv.config({ path: "../.env" })

const nextConfig: NextConfig = {
  /* config options here */
  output: 'export',
  // Allow importing from the workspace root for generated canister declarations
  experimental: {
    externalDir: true,
  },
  env: {
    NEXT_PUBLIC_CANISTER_ID_FINTRACK_BACKEND: process.env.CANISTER_ID_FINTRACK_BACKEND,
    NEXT_PUBLIC_CANISTER_ID_INTERNET_IDENTITY: process.env.CANISTER_ID_INTERNET_IDENTITY,
    NEXT_PUBLIC_CANISTER_ID_CKBTC_LEDGER: process.env.CANISTER_ID_CKBTC_LEDGER,
    NEXT_PUBLIC_CANISTER_ID_CKBTC_MINTER: process.env.CANISTER_ID_CKBTC_MINTER,
    NEXT_PUBLIC_CANISTER_ID_CKETH_LEDGER: process.env.CANISTER_ID_CKETH_LEDGER,
    NEXT_PUBLIC_CANISTER_ID_CKETH_MINTER: process.env.CANISTER_ID_CKETH_MINTER,
    NEXT_PUBLIC_DFX_NETWORK: process.env.DFX_NETWORK || "ic",
    NEXT_PUBLIC_IC_HOST: process.env.NEXT_PUBLIC_IC_HOST || "https://ic0.app",
  },
};

export default nextConfig;
