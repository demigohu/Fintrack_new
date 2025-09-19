import { 
  Token, 
  CurrencyAmount, 
  Percent, 
  TradeType,
  Currency
} from '@uniswap/sdk-core';
import { 
  V4Planner, 
  Actions, 
  PoolKey,
  SwapExactInSingle,
  SwapExactOutSingle
} from '@uniswap/v4-sdk';
import { 
  CommandType, 
  RoutePlanner 
} from '@uniswap/universal-router-sdk';
import { ethers } from "ethers";


// Types
export interface SwapParams {
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  amountOutMin: string;
  recipient: string;
  slippage: number; // percentage as number (e.g., 0.5 for 0.5%)
  deadline: number; // timestamp in seconds
}

export interface SwapCalldataResult {
  to: string;
  data: string;
  value: string;
}

export interface QuoteResult {
  amountOut: string;
  priceImpact: Percent;
  route: string;
  feeTier?: number;
}

// Constants
const UNIVERSAL_ROUTER_ADDRESS = "0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b"; // Sepolia Universal Router
const POOL_MANAGER_ADDRESS = "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543"; // Sepolia PoolManager
const STATE_VIEW_ADDRESS = "0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c"; // Sepolia StateView
const POOL_FEE_TIER = 3000; // 0.3% fee tier (more common)
const DEFAULT_TICK_SPACING = 60; // For 0.3% fee tier
const DEFAULT_HOOKS = "0x0000000000000000000000000000000000000000"; // No hooks

// Contract addresses for Sepolia
const QUOTER_ADDRESS = "0x61b3f2011a92d183c7dbadbda940a7555ccf9227"; // Sepolia Quoter

// Common tokens on Sepolia
export const SEPOLIA_TOKENS = {
  ETH: new Token(
    11155111, // Sepolia chain ID
    "0x0000000000000000000000000000000000000000", // ETH address
    18,
    "ETH",
    "Ethereum"
  ),
  USDC: new Token(
    11155111,
    "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Sepolia USDC
    6,
    "USDC",
    "USD Coin"
  ),
  WETH: new Token(
    11155111,
    "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", // Sepolia WETH
    18,
    "WETH",
    "Wrapped Ether"
  )
};

/**
 * Estimate amount out for a swap (quote) using Uniswap v4 Quoter contract
 * Based on: https://docs.uniswap.org/sdk/v4/guides/swaps/quoting
 */
export async function estimateAmountOut(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  provider: any
): Promise<QuoteResult> {
  // Uniswap v4 Quoter ABI for quoteExactInputSingle (correct ABI from your contract)
  const quoterABI = [
    {
      "inputs": [
        {
          "components": [
            {
              "components": [
                {
                  "internalType": "address",
                  "name": "currency0",
                  "type": "address"
                },
                {
                  "internalType": "address",
                  "name": "currency1",
                  "type": "address"
                },
                {
                  "internalType": "uint24",
                  "name": "fee",
                  "type": "uint24"
                },
                {
                  "internalType": "int24",
                  "name": "tickSpacing",
                  "type": "int24"
                },
                {
                  "internalType": "address",
                  "name": "hooks",
                  "type": "address"
                }
              ],
              "internalType": "struct PoolKey",
              "name": "poolKey",
              "type": "tuple"
            },
            {
              "internalType": "bool",
              "name": "zeroForOne",
              "type": "bool"
            },
            {
              "internalType": "uint128",
              "name": "exactAmount",
              "type": "uint128"
            },
            {
              "internalType": "bytes",
              "name": "hookData",
              "type": "bytes"
            }
          ],
          "internalType": "struct IV4Quoter.QuoteExactSingleParams",
          "name": "params",
          "type": "tuple"
        }
      ],
      "name": "quoteExactInputSingle",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "amountOut",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "gasEstimate",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];

  // Create contract instance
  const quoterContract = new ethers.Contract(QUOTER_ADDRESS, quoterABI, provider);

  // Use token addresses with proper resolution for pool consistency
  const tokenInAddress = resolveTokenAddress({ symbol: tokenIn.symbol || '', address: tokenIn.address });
  const tokenOutAddress = resolveTokenAddress({ symbol: tokenOut.symbol || '', address: tokenOut.address });

  // Sort addresses for pool key (currency0 < currency1)
  const [currency0, currency1] = tokenInAddress.toLowerCase() < tokenOutAddress.toLowerCase() 
    ? [tokenInAddress, tokenOutAddress]
    : [tokenOutAddress, tokenInAddress];

  // Determine swap direction (zeroForOne)
  const zeroForOne = tokenInAddress.toLowerCase() < tokenOutAddress.toLowerCase();

  // Try different fee tiers in order of preference (as per Uniswap v4 docs)
  const feeTiers = [
    { fee: 500, tickSpacing: 10 },   // 0.05% - as per docs example
    { fee: 3000, tickSpacing: 60 },  // 0.3% - most common
    { fee: 10000, tickSpacing: 200 } // 1% - higher fee
  ];

  let lastError: any = null;
  let bestQuote: { amountOut: string; fee: number; tickSpacing: number } | null = null;

  for (const feeConfig of feeTiers) {
    // Create pool key with sorted addresses
    const poolKey = {
      currency0: currency0,
      currency1: currency1,
      fee: feeConfig.fee,
      tickSpacing: feeConfig.tickSpacing,
      hooks: DEFAULT_HOOKS
    };

    try {
      // First check if pool exists and is initialized
      console.log(`Checking pool existence for fee tier ${feeConfig.fee}:`, {
        tokenIn: tokenIn.symbol,
        tokenOut: tokenOut.symbol,
        tokenInAddress,
        tokenOutAddress,
        currency0,
        currency1,
        fee: feeConfig.fee,
        tickSpacing: feeConfig.tickSpacing
      });
      
      const poolCheck = await checkPoolExists(tokenIn, tokenOut, feeConfig.fee, feeConfig.tickSpacing, provider);
      
      console.log(`Pool check result for fee tier ${feeConfig.fee}:`, {
        exists: poolCheck.exists,
        isInitialized: poolCheck.isInitialized,
        poolId: poolCheck.poolId
      });
      
      if (!poolCheck.exists || !poolCheck.isInitialized) {
        console.log(`❌ Pool not available for fee tier ${feeConfig.fee}, skipping...`);
        continue; // Skip this fee tier
      }
      
      console.log(`✅ Pool available for fee tier ${feeConfig.fee}, proceeding with quote...`);

      console.log("Trying quote with fee tier:", {
        tokenIn: tokenIn.symbol,
        tokenOut: tokenOut.symbol,
        amountIn,
        tokenInAddress,
        tokenOutAddress,
        currency0,
        currency1,
        poolKey,
        zeroForOne,
        quoterAddress: QUOTER_ADDRESS,
        poolExists: poolCheck.exists,
        poolInitialized: poolCheck.isInitialized
      });

       // Use callStatic to simulate the transaction without executing it
       // This is required because Uniswap v4 Quoter uses state-changing calls that are reverted
       // Based on official docs: https://docs.uniswap.org/sdk/v4/guides/swaps/quoting
       // For ethers v5, we need to pass parameters as a single object with 'params' key
       const quotedResult = await quoterContract.callStatic.quoteExactInputSingle({
         poolKey: poolKey,
         zeroForOne: zeroForOne,
         exactAmount: amountIn,
         hookData: '0x00'
       });

       // Handle response format - should return {amountOut, gasEstimate}
       let amountOut: string;
       if (typeof quotedResult === 'object' && quotedResult.amountOut) {
         amountOut = quotedResult.amountOut.toString();
       } else if (Array.isArray(quotedResult) && quotedResult.length >= 1) {
         amountOut = quotedResult[0].toString();
       } else {
         amountOut = quotedResult.toString();
       }
      
       console.log("Quote success with fee tier:", { 
         amountOut,
         fee: feeConfig.fee,
         rawResult: quotedResult,
         type: typeof quotedResult,
         formattedAmountOut: formatAmount(amountOut, tokenOut.decimals)
       });

       // Store this quote if it's better than the current best
       if (!bestQuote || BigInt(amountOut) > BigInt(bestQuote.amountOut)) {
         bestQuote = {
           amountOut,
           fee: feeConfig.fee,
           tickSpacing: feeConfig.tickSpacing
         };
         console.log("New best quote found:", {
           ...bestQuote,
           formattedAmountOut: formatAmount(bestQuote.amountOut, tokenOut.decimals)
         });
       } else {
         console.log("Quote not better than current best:", {
           currentBest: formatAmount(bestQuote.amountOut, tokenOut.decimals),
           thisQuote: formatAmount(amountOut, tokenOut.decimals)
         });
       }
    } catch (error: any) {
      console.log(`Quote failed with fee tier ${feeConfig.fee}:`, {
        error: error.message || error,
        code: error.code,
        data: error.data,
        reason: error.reason
      });
      lastError = error;
      continue; // Try next fee tier
    }
  }

  // If we found at least one successful quote, return the best one
  if (bestQuote) {
    console.log("Returning best quote:", bestQuote);
    
    // Calculate price impact (simplified calculation)
    const priceImpact = calculatePriceImpact(amountIn, bestQuote.amountOut, tokenIn, tokenOut);

    return {
      amountOut: bestQuote.amountOut,
      priceImpact,
      route: `${tokenIn.symbol} → ${tokenOut.symbol} (${bestQuote.fee/10000}% fee)`,
      feeTier: bestQuote.fee
    };
  }

  // If all fee tiers failed, provide informative error message
  console.error("All fee tiers failed:", lastError);
  throw new Error(`No initialized pools found for ${tokenIn.symbol}/${tokenOut.symbol} pair on Sepolia testnet. Pools exist but have no liquidity. You may need to add liquidity first or try different tokens.`);
}

/**
 * Calculate price impact (simplified version)
 */
function calculatePriceImpact(
  amountIn: string,
  amountOut: string,
  tokenIn: Token,
  tokenOut: Token
): Percent {
  try {
    // This is a simplified price impact calculation
    // In production, you'd want to get the current pool price and calculate the impact
    
    const amountInBN = BigInt(amountIn);
    const amountOutBN = BigInt(amountOut);
    
    // Simple calculation: assume 0.1% price impact for now
    // In reality, you'd calculate this based on current pool state
    return new Percent(1, 1000); // 0.1%
    
  } catch (error) {
    console.error("Price impact calculation error:", error);
    return new Percent(5, 1000); // 0.5% default
  }
}


/**
 * Build swap calldata for Universal Router
 */
export function buildSwapCalldata(params: SwapParams, feeTier?: number): SwapCalldataResult {
  try {
    const {
      tokenIn,
      tokenOut,
      amountIn,
      amountOutMin,
      recipient,
      slippage,
      deadline
    } = params;

    // Use the same fee tier as the quote, or default to POOL_FEE_TIER
    const fee = feeTier || POOL_FEE_TIER;
    const tickSpacing = fee === 500 ? 10 : fee === 3000 ? 60 : fee === 10000 ? 200 : DEFAULT_TICK_SPACING;
    
    // Create pool key
    const poolKey: PoolKey = {
      currency0: tokenIn.address,
      currency1: tokenOut.address,
      fee: fee,
      tickSpacing: tickSpacing,
      hooks: DEFAULT_HOOKS,
    };

    // Determine swap direction (zeroForOne)
    const zeroForOne = tokenIn.address.toLowerCase() < tokenOut.address.toLowerCase();

    // Create swap configuration
    const swapConfig: SwapExactInSingle = {
      poolKey,
      zeroForOne,
      amountIn,
      amountOutMinimum: amountOutMin,
      hookData: '0x00'
    };

    // Initialize planners
    const v4Planner = new V4Planner();
    const routePlanner = new RoutePlanner();

    // Add swap action
    v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [swapConfig]);
    
    // Add settlement actions
    v4Planner.addAction(Actions.SETTLE_ALL, [swapConfig.poolKey.currency0, swapConfig.amountIn]);
    v4Planner.addAction(Actions.TAKE_ALL, [swapConfig.poolKey.currency1, swapConfig.amountOutMinimum]);

    // Finalize v4 planner
    const encodedActions = v4Planner.finalize();

    // Add command to route planner
    routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params]);

    // Encode the transaction data
    const commands = routePlanner.commands;
    const inputs = [encodedActions];

    // Create Universal Router ABI
    const universalRouterABI = [
      {
        inputs: [
          { internalType: "bytes", name: "commands", type: "bytes" },
          { internalType: "bytes[]", name: "inputs", type: "bytes[]" },
          { internalType: "uint256", name: "deadline", type: "uint256" },
        ],
        name: "execute",
        outputs: [],
        stateMutability: "payable",
        type: "function",
      },
    ];

    // Create contract interface
    const iface = new ethers.utils.Interface(universalRouterABI);
    
    // Encode the function call
    const data = iface.encodeFunctionData("execute", [commands, inputs, deadline]);

    // Determine value (ETH amount if swapping from ETH)
    const isEthInput = tokenIn.address === "0x0000000000000000000000000000000000000000";
    const value = isEthInput ? amountIn : "0";

    return {
      to: UNIVERSAL_ROUTER_ADDRESS,
      data,
      value
    };

  } catch (error) {
    throw new Error(`Failed to build swap calldata: ${error}`);
  }
}

/**
 * Build exact output swap calldata (when you need exact amount out)
 */
export function buildExactOutputSwapCalldata(params: SwapParams): SwapCalldataResult {
  try {
    const {
      tokenIn,
      tokenOut,
      amountIn,
      amountOutMin,
      recipient,
      slippage,
      deadline
    } = params;

    // Create pool key
    const poolKey: PoolKey = {
      currency0: tokenIn.address,
      currency1: tokenOut.address,
      fee: POOL_FEE_TIER,
      tickSpacing: DEFAULT_TICK_SPACING,
      hooks: DEFAULT_HOOKS,
    };

    // Determine swap direction
    const zeroForOne = tokenIn.address.toLowerCase() < tokenOut.address.toLowerCase();

    // Create exact output swap configuration
    const swapConfig: SwapExactOutSingle = {
      poolKey,
      zeroForOne,
      amountOut: amountOutMin, // For exact output, this is the desired output amount
      amountInMaximum: amountIn, // Maximum input amount willing to pay
      hookData: '0x00'
    };

    // Initialize planners
    const v4Planner = new V4Planner();
    const routePlanner = new RoutePlanner();

    // Add swap action
    v4Planner.addAction(Actions.SWAP_EXACT_OUT_SINGLE, [swapConfig]);
    
    // Add settlement actions (reversed for exact output)
    v4Planner.addAction(Actions.SETTLE_ALL, [swapConfig.poolKey.currency0, swapConfig.amountInMaximum]);
    v4Planner.addAction(Actions.TAKE_ALL, [swapConfig.poolKey.currency1, swapConfig.amountOut]);

    // Finalize v4 planner
    const encodedActions = v4Planner.finalize();

    // Add command to route planner
    routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params]);

    // Encode the transaction data
    const commands = routePlanner.commands;
    const inputs = [encodedActions];

    // Create Universal Router ABI
    const universalRouterABI = [
      {
        inputs: [
          { internalType: "bytes", name: "commands", type: "bytes" },
          { internalType: "bytes[]", name: "inputs", type: "bytes[]" },
          { internalType: "uint256", name: "deadline", type: "uint256" },
        ],
        name: "execute",
        outputs: [],
        stateMutability: "payable",
        type: "function",
      },
    ];

    // Create contract interface
    const iface = new ethers.utils.Interface(universalRouterABI);
    
    // Encode the function call
    const data = iface.encodeFunctionData("execute", [commands, inputs, deadline]);

    // Determine value (ETH amount if swapping from ETH)
    const isEthInput = tokenIn.address === "0x0000000000000000000000000000000000000000";
    const value = isEthInput ? amountIn : "0";

    return {
      to: UNIVERSAL_ROUTER_ADDRESS,
      data,
      value
    };

  } catch (error) {
    throw new Error(`Failed to build exact output swap calldata: ${error}`);
  }
}

/**
 * Helper function to create deadline (current time + minutes)
 */
export function createDeadline(minutesFromNow: number = 20): number {
  return Math.floor(Date.now() / 1000) + (minutesFromNow * 60);
}

/**
 * Helper function to calculate minimum amount out with slippage
 */
export function calculateAmountOutMin(amountOut: string, slippagePercent: number): string {
  const amountOutBN = BigInt(amountOut);
  const slippageBasisPoints = Math.floor(slippagePercent * 100); // Convert to basis points
  const slippageMultiplier = 10000 - slippageBasisPoints; // 10000 = 100%
  
  return ((amountOutBN * BigInt(slippageMultiplier)) / BigInt(10000)).toString();
}

/**
 * Helper function to format amount for display
 */
export function formatAmount(amount: string, decimals: number): string {
  return ethers.utils.formatUnits(amount, decimals);
}

/**
 * Helper function to parse amount from user input
 */
export function parseAmount(amount: string, decimals: number): string {
  return ethers.utils.parseUnits(amount, decimals).toString();
}

/**
 * Example usage function
 */
export async function exampleSwap() {
  try {
    // Example: Swap 1 ETH to USDC
    const tokenIn = SEPOLIA_TOKENS.ETH;
    const tokenOut = SEPOLIA_TOKENS.USDC;
    const amountIn = parseAmount("1", 18); // 1 ETH
    const slippage = 0.5; // 0.5%
    const deadline = createDeadline(20); // 20 minutes from now

    // Get quote first
    const quote = await estimateAmountOut(tokenIn, tokenOut, amountIn, null as any);
    const amountOutMin = calculateAmountOutMin(quote.amountOut, slippage);

    // Build swap calldata
    const swapParams: SwapParams = {
      tokenIn,
      tokenOut,
      amountIn,
      amountOutMin,
      recipient: "0x1234567890123456789012345678901234567890", // User's address
      slippage,
      deadline
    };

    const calldata = buildSwapCalldata(swapParams);

    console.log("Swap calldata:", calldata);
    return calldata;

  } catch (error) {
    console.error("Example swap failed:", error);
    throw error;
  }
}

/**
 * Build approval calldata for ERC20 token
 */
export function buildApprovalCalldata(
  tokenAddress: string,
  spenderAddress: string,
  amount: string
): { to: string; data: string; value: string } | null {
  // Only need approval for non-ETH tokens
  if (tokenAddress === "0x0000000000000000000000000000000000000000") {
    return null;
  }

  // ERC20 approve ABI
  const approveABI = [
    {
      inputs: [
        { internalType: "address", name: "spender", type: "address" },
        { internalType: "uint256", name: "amount", type: "uint256" }
      ],
      name: "approve",
      outputs: [{ internalType: "bool", name: "", type: "bool" }],
      stateMutability: "nonpayable",
      type: "function"
    }
  ];

  const iface = new ethers.utils.Interface(approveABI);
  const data = iface.encodeFunctionData("approve", [spenderAddress, amount]);

  return {
    to: tokenAddress,
    data,
    value: "0"
  };
}

/**
 * Check if token approval is needed
 */
export function isApprovalNeeded(tokenAddress: string): boolean {
  return tokenAddress !== "0x0000000000000000000000000000000000000000";
}

// StateView ABI for pool data fetching
const STATE_VIEW_ABI = [
  {
    "inputs": [
      {"internalType": "bytes32", "name": "poolId", "type": "bytes32"}
    ],
    "name": "getSlot0",
    "outputs": [
      {"internalType": "uint160", "name": "sqrtPriceX96", "type": "uint160"},
      {"internalType": "int24", "name": "tick", "type": "int24"},
      {"internalType": "uint24", "name": "protocolFee", "type": "uint24"},
      {"internalType": "uint24", "name": "lpFee", "type": "uint24"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "bytes32", "name": "poolId", "type": "bytes32"}
    ],
    "name": "getLiquidity",
    "outputs": [
      {"internalType": "uint128", "name": "liquidity", "type": "uint128"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// PoolManager ABI for pool initialization check (updated with correct ABI)
const POOL_MANAGER_ABI = [
  {
    "inputs": [
      {"internalType": "bytes32", "name": "slot", "type": "bytes32"}
    ],
    "name": "extsload",
    "outputs": [
      {"internalType": "bytes32", "name": "", "type": "bytes32"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "bytes32", "name": "startSlot", "type": "bytes32"},
      {"internalType": "uint256", "name": "nSlots", "type": "uint256"}
    ],
    "name": "extsload",
    "outputs": [
      {"internalType": "bytes32[]", "name": "", "type": "bytes32[]"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Helper function to resolve token address for Quoter (ETH -> WETH)
function resolveTokenAddress(token: { symbol: string; address: string }): string {
  if (token.symbol === "ETH") {
    return SEPOLIA_TOKENS.WETH.address;
  }
  return token.address;
}

// Function to compute PoolId from PoolKey
export function computePoolId(
  currency0: string,
  currency1: string,
  fee: number,
  tickSpacing: number,
  hooks: string
): string {
  // This is a simplified version - in production you'd use the actual SDK method
  const poolKey = ethers.utils.solidityKeccak256(
    ['address', 'address', 'uint24', 'int24', 'address'],
    [currency0, currency1, fee, tickSpacing, hooks]
  );
  return poolKey;
}

// Function to check if pool exists and is initialized
export async function checkPoolExists(
  tokenIn: Token,
  tokenOut: Token,
  fee: number,
  tickSpacing: number,
  provider: ethers.providers.Provider
): Promise<{ exists: boolean; isInitialized: boolean; poolId?: string }> {
  try {
    // Resolve token addresses for pool key
    const tokenInAddress = resolveTokenAddress({ symbol: tokenIn.symbol || '', address: tokenIn.address });
    const tokenOutAddress = resolveTokenAddress({ symbol: tokenOut.symbol || '', address: tokenOut.address });
    
    // Ensure proper ordering (currency0 < currency1)
    const [currency0, currency1] = tokenInAddress < tokenOutAddress 
      ? [tokenInAddress, tokenOutAddress]
      : [tokenOutAddress, tokenInAddress];
    
    const poolId = computePoolId(currency0, currency1, fee, tickSpacing, DEFAULT_HOOKS);
    
    // Try to get pool data from StateView
    const stateViewContract = new ethers.Contract(STATE_VIEW_ADDRESS, STATE_VIEW_ABI, provider);
    
    try {
      console.log(`🔍 Checking StateView for poolId: ${poolId}`);
      const [slot0, liquidity] = await Promise.all([
        stateViewContract.getSlot0(poolId),
        stateViewContract.getLiquidity(poolId)
      ]);
      
      console.log(`📊 StateView data:`, {
        sqrtPriceX96: slot0.sqrtPriceX96.toString(),
        tick: slot0.tick,
        liquidity: liquidity.toString(),
        poolId
      });
      
      // If we can get data, pool exists
      // Pool is initialized if it has non-zero sqrtPriceX96 and liquidity
      const isInitialized = slot0.sqrtPriceX96.gt(0) && liquidity.gt(0);
      
      console.log(`✅ StateView success - exists: true, initialized: ${isInitialized}`);
      console.log(`📊 Pool status:`, {
        sqrtPriceX96: slot0.sqrtPriceX96.toString(),
        liquidity: liquidity.toString(),
        isInitialized,
        reason: !isInitialized ? 
          (slot0.sqrtPriceX96.eq(0) ? 'sqrtPriceX96 is 0' : 'liquidity is 0') : 
          'pool is ready'
      });
      
      return {
        exists: true,
        isInitialized,
        poolId
      };
    } catch (error: any) {
      console.log(`❌ StateView failed:`, error.message);
      // If StateView fails, try PoolManager directly
      const poolManagerContract = new ethers.Contract(POOL_MANAGER_ADDRESS, POOL_MANAGER_ABI, provider);
      
      try {
        console.log(`🔍 Trying PoolManager for poolId: ${poolId}`);
        const slot0 = await poolManagerContract.getSlot0(poolId);
        const isInitialized = slot0.sqrtPriceX96.gt(0);
        
        console.log(`📊 PoolManager data:`, {
          sqrtPriceX96: slot0.sqrtPriceX96.toString(),
          tick: slot0.tick,
          isInitialized
        });
        
        console.log(`✅ PoolManager success - exists: true, initialized: ${isInitialized}`);
        return {
          exists: true,
          isInitialized,
          poolId
        };
      } catch (poolManagerError: any) {
        console.log(`❌ PoolManager also failed:`, poolManagerError.message);
        console.log(`❌ Pool doesn't exist for poolId: ${poolId}`);
        // Pool doesn't exist
        return {
          exists: false,
          isInitialized: false,
          poolId
        };
      }
    }
  } catch (error) {
    console.error('Error checking pool existence:', error);
    return {
      exists: false,
      isInitialized: false
    };
  }
}
