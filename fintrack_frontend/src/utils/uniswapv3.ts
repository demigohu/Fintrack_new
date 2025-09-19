import { 
  Token, 
  CurrencyAmount, 
  Percent, 
  TradeType,
  Currency,
  Ether
} from '@uniswap/sdk-core';
import { 
  Pool,
  Route,
  Trade,
  SwapQuoter,
  SwapRouter,
  computePoolAddress,
  nearestUsableTick,
  TickMath,
  encodeSqrtRatioX96,
  FeeAmount,
  TICK_SPACINGS,
  SwapOptions
} from '@uniswap/v3-sdk';
import { 
  Trade as RouterTrade,
  MixedRouteTrade
} from '@uniswap/router-sdk';
import { 
  SwapRouter as UniversalRouter
} from '@uniswap/universal-router-sdk';
import { ethers } from "ethers";
import JSBI from 'jsbi';


// Types
export interface SwapParamsV3 {
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  amountOutMin: string;
  recipient: string;
  slippage: number; // percentage as number (e.g., 0.5 for 0.5%)
  deadline: number; // timestamp in seconds
  fee: FeeAmount; // Fee tier (LOW, MEDIUM, HIGH)
}

// Pool info interface (based on Uniswap reference)
export interface PoolInfo {
  token0: string;
  token1: string;
  fee: number;
  tickSpacing: number;
  sqrtPriceX96: ethers.BigNumber;
  liquidity: ethers.BigNumber;
  tick: number;
}

// Trade type (based on Uniswap reference)
export type TokenTrade = Trade<Token, Token, TradeType>;

export interface SwapCalldataResultV3 {
  to: string;
  data: string;
  value: string;
}

export interface QuoteResultV3 {
  amountOut: string;
  priceImpact: Percent;
  route: string;
  fee: FeeAmount;
  poolAddress: string;
}

// Constants for Sepolia (based on Uniswap reference)
export const POOL_FACTORY_CONTRACT_ADDRESS = "0x0227628f3F023bb0B980b67D528571c95c6DaC1c"; // Sepolia V3 Factory
export const QUOTER_CONTRACT_ADDRESS = "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3"; // Sepolia V3 Quoter
export const SWAP_ROUTER_ADDRESS = "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E"; // Sepolia V3 SwapRouter
export const UNIVERSAL_ROUTER_ADDRESS = "0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b"; // Sepolia Universal Router
export const PERMIT2_ADDRESS = "0x000000000022d473030f116ddee9f6b43ac78ba3"; // Permit2 contract
export const WETH_CONTRACT_ADDRESS = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"; // Sepolia WETH

// Transaction constants
export const MAX_FEE_PER_GAS = 100000000000;
export const MAX_PRIORITY_FEE_PER_GAS = 100000000000;

// ABI's (based on Uniswap reference)
export const ERC20_ABI = [
  // Read-Only Functions
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',

  // Authenticated Functions
  'function transfer(address to, uint amount) returns (bool)',
  'function approve(address _spender, uint256 _value) returns (bool)',

  // Events
  'event Transfer(address indexed from, address indexed to, uint amount)',
];

export const WETH_ABI = [
  // Wrap ETH
  'function deposit() payable',

  // Unwrap ETH
  'function withdraw(uint wad) public',
];

// Common tokens on Sepolia
export const SEPOLIA_TOKENS_V3 = {
  ETH: Ether.onChain(11155111), // Sepolia ETH
  WETH: new Token(
    11155111,
    "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", // Sepolia WETH
    18,
    "WETH",
    "Wrapped Ether"
  ),
  USDC: new Token(
    11155111,
    "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Sepolia USDC
    6,
    "USDC",
    "USD Coin"
  ),
  USDT: new Token(
    11155111,
    "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06", // Sepolia USDT
    6,
    "USDT",
    "Tether USD"
  )
};

// Fee amounts for V3
export const FEE_AMOUNTS = {
  LOW: FeeAmount.LOW,    // 0.05%
  MEDIUM: FeeAmount.MEDIUM, // 0.3%
  HIGH: FeeAmount.HIGH   // 1%
};

// Helper function to convert readable amount to raw amount
export function fromReadableAmount(amount: number, decimals: number): string {
  return ethers.utils.parseUnits(amount.toString(), decimals).toString();
}

// Helper function to convert raw amount to readable amount
export function toReadableAmount(amount: string, decimals: number): string {
  return ethers.utils.formatUnits(amount, decimals);
}

/**
 * Get pool info for a given token pair and fee tier (based on Uniswap reference)
 */
export async function getPoolInfo(
  tokenA: Token,
  tokenB: Token,
  feeAmount: FeeAmount,
  provider: ethers.providers.Provider
): Promise<PoolInfo> {
  const currentPoolAddress = computePoolAddress({
    factoryAddress: POOL_FACTORY_CONTRACT_ADDRESS,
    tokenA,
    tokenB,
    fee: feeAmount,
  });

  // Pool ABI for basic info
  const poolABI = [
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function fee() view returns (uint24)",
    "function tickSpacing() view returns (int24)",
    "function liquidity() view returns (uint128)",
    "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
  ];

  const poolContract = new ethers.Contract(currentPoolAddress, poolABI, provider);

  const [token0, token1, fee, tickSpacing, liquidity, slot0] = await Promise.all([
    poolContract.token0(),
    poolContract.token1(),
    poolContract.fee(),
    poolContract.tickSpacing(),
    poolContract.liquidity(),
    poolContract.slot0(),
  ]);

  return {
    token0,
    token1,
    fee,
    tickSpacing,
    liquidity,
    sqrtPriceX96: slot0[0],
    tick: slot0[1],
  };
}

/**
 * Get pool data for a given token pair and fee tier (based on example)
 */
export async function getPool(
  tokenA: Token,
  tokenB: Token,
  feeAmount: FeeAmount,
  provider: ethers.providers.Provider
): Promise<Pool | null> {
  try {
    const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA];

    const poolAddress = Pool.getAddress(token0, token1, feeAmount);

    console.log(`Getting pool data for ${token0.symbol}/${token1.symbol} with fee ${feeAmount}:`, {
      poolAddress,
      token0: token0.address,
      token1: token1.address,
      feeAmount
    });

    // Pool ABI for basic info
    const poolABI = [
      "function liquidity() view returns (uint128)",
      "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
    ];
    
    const contract = new ethers.Contract(poolAddress, poolABI, provider);

    try {
      const [liquidity, slot0] = await Promise.all([
        contract.liquidity(),
        contract.slot0()
      ]);

      const { sqrtPriceX96, tick } = slot0;

      console.log(`Pool data retrieved:`, {
        liquidity: liquidity.toString(),
        sqrtPriceX96: sqrtPriceX96.toString(),
        tick: tick.toString()
      });

      // Convert to JSBI for SDK compatibility
      const liquidityJSBI = JSBI.BigInt(liquidity.toString());
      const sqrtPriceX96JSBI = JSBI.BigInt(sqrtPriceX96.toString());

      // Create pool with ticks (based on example)
      const pool = new Pool(
        token0,
        token1,
        feeAmount,
        sqrtPriceX96JSBI,
        liquidityJSBI,
        tick,
        [
          {
            index: nearestUsableTick(TickMath.MIN_TICK, TICK_SPACINGS[feeAmount]),
            liquidityNet: liquidityJSBI,
            liquidityGross: liquidityJSBI,
          },
          {
            index: nearestUsableTick(TickMath.MAX_TICK, TICK_SPACINGS[feeAmount]),
            liquidityNet: JSBI.multiply(liquidityJSBI, JSBI.BigInt('-1')),
            liquidityGross: liquidityJSBI,
          },
        ]
      );

      return pool;
    } catch (error: any) {
      console.log(`Pool contract call failed:`, error.message);
      return null;
    }
  } catch (error) {
    console.error('Error getting pool data:', error);
    return null;
  }
}

/**
 * Create trade based on Uniswap reference
 */
export async function createTrade(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: number,
  feeAmount: FeeAmount,
  provider: ethers.providers.Provider
): Promise<TokenTrade> {
  try {
    // Validate input
    if (amountIn <= 0 || !isFinite(amountIn)) {
      throw new Error("Invalid input amount");
    }

    const poolInfo = await getPoolInfo(tokenIn, tokenOut, feeAmount, provider);

    // Validate pool info
    if (!poolInfo || poolInfo.liquidity.isZero()) {
      throw new Error("Pool has no liquidity");
    }

    const pool = new Pool(
      tokenIn,
      tokenOut,
      feeAmount,
      poolInfo.sqrtPriceX96.toString(),
      poolInfo.liquidity.toString(),
      poolInfo.tick
    );

    const swapRoute = new Route([pool], tokenIn, tokenOut);

    const amountOut = await getOutputQuote(swapRoute, tokenIn, amountIn, provider);

    // Validate output amount
    if (!amountOut || ethers.BigNumber.from(amountOut).isZero()) {
      throw new Error("Invalid output amount from quote");
    }

    const uncheckedTrade = Trade.createUncheckedTrade({
      route: swapRoute,
      inputAmount: CurrencyAmount.fromRawAmount(
        tokenIn,
        fromReadableAmount(amountIn, tokenIn.decimals).toString()
      ),
      outputAmount: CurrencyAmount.fromRawAmount(
        tokenOut,
        JSBI.BigInt(amountOut)
      ),
      tradeType: TradeType.EXACT_INPUT,
    });

    return uncheckedTrade;
  } catch (error) {
    console.error("createTrade failed:", error);
    throw new Error(`Failed to create trade: ${error}`);
  }
}

/**
 * Get output quote using SwapQuoter (based on Uniswap reference)
 */
async function getOutputQuote(
  route: Route<Currency, Currency>,
  tokenIn: Token,
  amountIn: number,
  provider: ethers.providers.Provider
): Promise<string> {
  try {
    const { calldata } = await SwapQuoter.quoteCallParameters(
      route,
      CurrencyAmount.fromRawAmount(
        tokenIn,
        fromReadableAmount(amountIn, tokenIn.decimals).toString()
      ),
      TradeType.EXACT_INPUT,
      {
        useQuoterV2: true,
      }
    );

    const quoteCallReturnData = await provider.call({
      to: QUOTER_CONTRACT_ADDRESS,
      data: calldata,
    });

    const result = ethers.utils.defaultAbiCoder.decode(['uint256'], quoteCallReturnData)[0];
    
    // Validate result
    if (!result || ethers.BigNumber.from(result).isZero()) {
      throw new Error("Quote returned zero amount");
    }
    
    return result;
  } catch (error) {
    console.error("getOutputQuote failed:", error);
    throw new Error(`Failed to get output quote: ${error}`);
  }
}

/**
 * Build trade for Universal Router (based on example)
 */
export function buildTrade(trades: any[]): any {
  return new RouterTrade({
    v2Routes: [], // No V2 routes for V3-only implementation
    v3Routes: trades
      .filter((trade) => trade instanceof Trade)
      .map((trade) => ({
        routev3: (trade as any).route,
        inputAmount: (trade as any).inputAmount,
        outputAmount: (trade as any).outputAmount,
      })),
    mixedRoutes: trades
      .filter((trade) => trade instanceof MixedRouteTrade)
      .map((trade) => ({
        mixedRoute: (trade as any).route,
        inputAmount: (trade as any).inputAmount,
        outputAmount: (trade as any).outputAmount,
      })),
    tradeType: trades[0].tradeType,
  });
}

/**
 * Execute trade using Universal Router
 */
export async function executeTrade(
  trade: TokenTrade,
  recipient: string,
  provider: ethers.providers.Provider
): Promise<SwapCalldataResultV3> {
  // Build router trade for Universal Router
  const routerTrade = buildTrade([trade]);

  // Set swap options for Universal Router
  const opts = swapOptions({
    slippageTolerance: new Percent(50, 10_000), // 50 bips, or 0.50%
    recipient,
    deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes from the current Unix time
  });

  // Get Universal Router parameters
  const params = UniversalRouter.swapCallParameters(routerTrade, opts);

  // Create Universal Router ABI for execute function
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
  
  // Encode the function call with deadline (consistent with uniswap.ts)
  const data = iface.encodeFunctionData("execute", [params.calldata, [], opts.deadline]);

  return {
    to: UNIVERSAL_ROUTER_ADDRESS,
    data,
    value: params.value
  };
}


/**
 * Swap options for Universal Router (based on example)
 */
export function swapOptions(options: {
  slippageTolerance?: Percent;
  recipient?: string;
  deadline?: number;
}) {
  return Object.assign(
    {
      slippageTolerance: new Percent(5, 100), // 0.5% default
      recipient: options.recipient || '0x0000000000000000000000000000000000000000',
      deadline: options.deadline || Math.floor(Date.now() / 1000) + 1200, // 20 minutes
    },
    options
  );
}

/**
 * Get quote using Universal Router approach (based on example)
 */
export async function getUniversalRouterQuote(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  provider: ethers.providers.Provider
): Promise<QuoteResultV3> {
  try {
    // Try different fee tiers
    const feeTiers = [FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH];
    
    for (const feeAmount of feeTiers) {
      try {
        console.log(`Getting quote for fee tier ${feeAmount} for ${tokenIn.symbol}/${tokenOut.symbol}`);
        
        // Get pool
        const pool = await getPool(tokenIn, tokenOut, feeAmount, provider);
        if (!pool) {
          console.log(`No pool found for fee tier ${feeAmount}`);
          continue;
        }

        // Create route
        const route = new Route([pool], tokenIn, tokenOut);

        // Create trade
        const inputAmount = CurrencyAmount.fromRawAmount(tokenIn, amountIn);
        const trade = await Trade.fromRoute(route, inputAmount, TradeType.EXACT_INPUT);

        console.log(`Quote successful for fee tier ${feeAmount}:`, {
          inputAmount: trade.inputAmount.toExact(),
          outputAmount: trade.outputAmount.toExact(),
          priceImpact: trade.priceImpact.toFixed(2),
          feeAmount
        });

        return {
          amountOut: trade.outputAmount.quotient.toString(),
          priceImpact: trade.priceImpact,
          route: `${tokenIn.symbol} → ${tokenOut.symbol} (${feeAmount/10000}% fee)`,
          fee: feeAmount,
          poolAddress: pool.token0.address < pool.token1.address ? 
            Pool.getAddress(pool.token0, pool.token1, feeAmount) :
            Pool.getAddress(pool.token1, pool.token0, feeAmount)
        };

      } catch (error: any) {
        console.log(`Failed to get quote for fee tier ${feeAmount}:`, error.message);
        continue;
      }
    }

    throw new Error(`No available pools found for ${tokenIn.symbol}/${tokenOut.symbol} pair`);

  } catch (error) {
    throw new Error(`Failed to get Universal Router quote: ${error}`);
  }
}

/**
 * Build Universal Router calldata for V3 swap (based on example)
 */
export async function buildUniversalRouterCalldata(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  recipient: string,
  slippage: number,
  deadline: number,
  provider: ethers.providers.Provider
): Promise<SwapCalldataResultV3> {
  try {
    // Try different fee tiers
    const feeTiers = [FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH];
    
    for (const feeAmount of feeTiers) {
      try {
        console.log(`Trying fee tier ${feeAmount} for ${tokenIn.symbol}/${tokenOut.symbol}`);
        
        // Get pool
        const pool = await getPool(tokenIn, tokenOut, feeAmount, provider);
        if (!pool) {
          console.log(`No pool found for fee tier ${feeAmount}`);
          continue;
        }

        // Create route
        const route = new Route([pool], tokenIn, tokenOut);

        // Create trade
        const inputAmount = CurrencyAmount.fromRawAmount(tokenIn, amountIn);
        const trade = await Trade.fromRoute(route, inputAmount, TradeType.EXACT_INPUT);

        // Build router trade
        const routerTrade = buildTrade([trade]);

        // Set swap options
        const opts = swapOptions({
          slippageTolerance: new Percent(Math.floor(slippage * 100), 10000), // Convert to basis points
          recipient,
          deadline
        });

        // Get Universal Router parameters
        const params = UniversalRouter.swapCallParameters(routerTrade, opts);

        console.log(`Universal Router calldata built successfully for fee tier ${feeAmount}:`, {
          to: UNIVERSAL_ROUTER_ADDRESS,
          data: params.calldata,
          value: params.value,
          feeAmount
        });

        return {
          to: UNIVERSAL_ROUTER_ADDRESS,
          data: params.calldata,
          value: params.value
        };

      } catch (error: any) {
        console.log(`Failed to build calldata for fee tier ${feeAmount}:`, error.message);
        continue;
      }
    }

    throw new Error(`No available pools found for ${tokenIn.symbol}/${tokenOut.symbol} pair`);

  } catch (error) {
    throw new Error(`Failed to build Universal Router calldata: ${error}`);
  }
}

// Helper function to format amount for display
export function formatAmount(amount: string, decimals: number): string {
  const formatted = toReadableAmount(amount, decimals);
  const num = parseFloat(formatted);
  if (num < 0.0001) return "< 0.0001";
  return num.toFixed(6).replace(/\.?0+$/, "");
}

// Helper function to create deadline (current time + minutes)
export function createDeadline(minutes: number = 20): number {
  return Math.floor(Date.now() / 1000) + (minutes * 60);
}

// Helper function to calculate minimum amount out with slippage
export function calculateAmountOutMin(amountOut: string, slippage: number): string {
  const slippagePercent = new Percent(Math.floor(slippage * 100), 10000);
  const amountOutBN = ethers.BigNumber.from(amountOut);
  const slippageAmount = amountOutBN.mul(slippagePercent.numerator.toString()).div(slippagePercent.denominator.toString());
  return amountOutBN.sub(slippageAmount).toString();
}


/**
 * Get quote using V3 Quoter contract
 */
export async function getQuoteV3(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  fee: FeeAmount,
  provider: ethers.providers.Provider
): Promise<QuoteResultV3> {
  try {
    // Quoter ABI
    const quoterABI = [
      {
        "inputs": [
          {"internalType": "address", "name": "tokenIn", "type": "address"},
          {"internalType": "address", "name": "tokenOut", "type": "address"},
          {"internalType": "uint24", "name": "fee", "type": "uint24"},
          {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
          {"internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160"}
        ],
        "name": "quoteExactInputSingle",
        "outputs": [
          {"internalType": "uint256", "name": "amountOut", "type": "uint256"}
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ];

    const quoterContract = new ethers.Contract(QUOTER_CONTRACT_ADDRESS, quoterABI, provider);

    // Get quote using callStatic
    const amountOut = await quoterContract.callStatic.quoteExactInputSingle(
      tokenIn.address,
      tokenOut.address,
      fee,
      amountIn,
      0 // sqrtPriceLimitX96 = 0 means no limit
    );

    // Calculate price impact (simplified)
    const priceImpact = calculatePriceImpact(amountIn, amountOut.toString(), tokenIn, tokenOut);

    // Get pool address
    const poolAddress = computePoolAddress({
      factoryAddress: POOL_FACTORY_CONTRACT_ADDRESS,
      tokenA: tokenIn,
      tokenB: tokenOut,
      fee
    });

    return {
      amountOut: amountOut.toString(),
      priceImpact,
      route: `${tokenIn.symbol} → ${tokenOut.symbol} (${fee/10000}% fee)`,
      fee,
      poolAddress
    };
  } catch (error) {
    console.error("Quote failed:", error);
    throw new Error(`Failed to get quote: ${error}`);
  }
}

/**
 * Get quote using V3 QuoterV2 contract (more detailed)
 */
export async function getQuoteV2(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  fee: FeeAmount,
  provider: ethers.providers.Provider
): Promise<{
  amountOut: string;
  gasEstimate: string;
  initializedTicksCrossed: string;
  sqrtPriceX96After: string;
  priceImpact: Percent;
  route: string;
  fee: FeeAmount;
  poolAddress: string;
}> {
  try {
    // QuoterV2 ABI
    const quoterV2ABI = [
      {
        "inputs": [
          {
            "components": [
              {"internalType": "address", "name": "tokenIn", "type": "address"},
              {"internalType": "address", "name": "tokenOut", "type": "address"},
              {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
              {"internalType": "uint24", "name": "fee", "type": "uint24"},
              {"internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160"}
            ],
            "internalType": "struct IQuoterV2.QuoteExactInputSingleParams",
            "name": "params",
            "type": "tuple"
          }
        ],
        "name": "quoteExactInputSingle",
        "outputs": [
          {"internalType": "uint256", "name": "amountOut", "type": "uint256"},
          {"internalType": "uint160", "name": "sqrtPriceX96After", "type": "uint160"},
          {"internalType": "uint32", "name": "initializedTicksCrossed", "type": "uint32"},
          {"internalType": "uint256", "name": "gasEstimate", "type": "uint256"}
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ];

    const quoterV2Contract = new ethers.Contract(QUOTER_CONTRACT_ADDRESS, quoterV2ABI, provider);

    // Get quote using callStatic
    const result = await quoterV2Contract.callStatic.quoteExactInputSingle({
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      amountIn,
      fee,
      sqrtPriceLimitX96: 0
    });

    // Calculate price impact
    const priceImpact = calculatePriceImpact(amountIn, result.amountOut.toString(), tokenIn, tokenOut);

    // Get pool address
    const poolAddress = computePoolAddress({
      factoryAddress: POOL_FACTORY_CONTRACT_ADDRESS,
      tokenA: tokenIn,
      tokenB: tokenOut,
      fee
    });

    return {
      amountOut: result.amountOut.toString(),
      gasEstimate: result.gasEstimate.toString(),
      initializedTicksCrossed: result.initializedTicksCrossed.toString(),
      sqrtPriceX96After: result.sqrtPriceX96After.toString(),
      priceImpact,
      route: `${tokenIn.symbol} → ${tokenOut.symbol} (${fee/10000}% fee)`,
      fee,
      poolAddress
    };
  } catch (error) {
    console.error("QuoteV2 failed:", error);
    throw new Error(`Failed to get quote: ${error}`);
  }
}

/**
 * Build swap calldata using Universal Router (default - with Permit2)
 * Based on: https://docs.uniswap.org/contracts/universal-router/technical-reference
 */
export async function buildSwapCalldataV3(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  amountOutMin: string,
  recipient: string,
  fee: FeeAmount,
  slippage: number,
  deadline: number,
  provider: ethers.providers.Provider,
  isOriginalEthInput: boolean = false,
  isOriginalEthOutput: boolean = false
): Promise<SwapCalldataResultV3> {
  // Use the WithPermit2 version as default for single transaction
  return await buildSwapCalldataV3_WithPermit2(
    tokenIn,
    tokenOut,
    amountIn,
    amountOutMin,
    recipient,
    fee,
    slippage,
    deadline,
    provider,
    isOriginalEthInput,
    isOriginalEthOutput
  );
}

/**
 * Build swap calldata using Universal Router with Permit2
 * (Single transaction approach - requires ERC20 approval to Permit2 beforehand)
 */
export async function buildSwapCalldataV3_WithPermit2(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  amountOutMin: string,
  recipient: string,
  fee: FeeAmount,
  slippage: number,
  deadline: number,
  provider: ethers.providers.Provider,
  isOriginalEthInput: boolean = false,
  isOriginalEthOutput: boolean = false
): Promise<SwapCalldataResultV3> {
  try {
    // Determine if we need WRAP_ETH command:
    // - If original input was ETH: need WRAP_ETH (isOriginalEthInput = true)
    // - If original input was WETH/token: no WRAP_ETH needed (isOriginalEthInput = false)
    const isEthInput = isOriginalEthInput;
    
    // Determine if we need UNWRAP_WETH command:
    // - If original output was ETH: need UNWRAP_WETH (isOriginalEthOutput = true)
    // - If original output was WETH/token: no UNWRAP_WETH needed (isOriginalEthOutput = false)
    const isEthOutput = isOriginalEthOutput;
    
    console.log("Token addresses:", {
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      isOriginalEthInput,
      isOriginalEthOutput,
      isEthInput,
      isEthOutput,
      zeroAddress: ethers.constants.AddressZero,
      wethAddress: WETH_CONTRACT_ADDRESS
    });
    
    // Build commands and inputs arrays
    const commands: string[] = [];
    const inputs: string[] = [];
    
    // 1. WRAP_ETH (0x0b) - if input is ETH (need to wrap to WETH first)
    if (isEthInput) {
      console.log("Adding WRAP_ETH command");
      commands.push("0x0b");
      const wrapInput = ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256"],
        [recipient, amountIn]
      );
      inputs.push(wrapInput);
    }
    
    // 2. PERMIT2_TRANSFER_FROM (0x02) - transfer token to Universal Router
    // For ETH input: transfer WETH (after wrapping)
    // For WETH/Token input: transfer directly
    const tokenToTransfer = isEthInput ? WETH_CONTRACT_ADDRESS : tokenIn.address;
    
    console.log("Adding PERMIT2_TRANSFER_FROM command for token:", tokenToTransfer);
    commands.push("0x02");
    const permit2TransferInput = ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "uint160"],
      [
        tokenToTransfer,    // token (WETH for ETH input, or original token)
        UNIVERSAL_ROUTER_ADDRESS, // recipient (Universal Router)
        amountIn            // amount (as uint160)
      ]
    );
    inputs.push(permit2TransferInput);
    
    // 3. V3_SWAP_EXACT_IN (0x00)
    console.log("Adding V3_SWAP_EXACT_IN command");
    commands.push("0x00");
    
    // Build V3 path: tokenIn -> tokenOut with fee
    const path = buildV3Path(tokenIn, tokenOut, fee);
    
    // V3_SWAP_EXACT_IN parameters:
    // address recipient, uint256 amountIn, uint256 amountOutMin, bytes path, bool payerIsUser
    const swapInput = ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256", "uint256", "bytes", "bool"],
      [
        isEthOutput ? UNIVERSAL_ROUTER_ADDRESS : recipient, // recipient: Universal Router for ETH output, user for token output
        amountIn,      // amountIn
        amountOutMin,  // amountOutMin
        path,          // path
        false          // payerIsUser = false (Permit2 already transferred to router)
      ]
    );
    inputs.push(swapInput);
    
    // 4. UNWRAP_WETH (0x0c) - if output is ETH
    if (isEthOutput) {
      console.log("Adding UNWRAP_WETH command");
      commands.push("0x0c");
      const unwrapInput = ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256"],
        [recipient, "0"] // amountMinimum = 0 (unwrap all WETH)
      );
      inputs.push(unwrapInput);
    }
    
    // 5. SWEEP (0x04) - clean up any remaining tokens
    console.log("Adding SWEEP command");
    commands.push("0x04");
    const sweepToken = isEthOutput ? WETH_CONTRACT_ADDRESS : tokenOut.address;
    const sweepInput = ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "uint256"],
      [sweepToken, recipient, "0"] // amountMin = 0
    );
    inputs.push(sweepInput);
    
    // Combine commands into single bytes (each command is 1 byte)
    const commandsBytes = "0x" + commands.map(cmd => cmd.slice(2)).join("");
    
    // Debug logging
    console.log("Universal Router commands:", {
      isEthInput,
      isEthOutput,
      tokenToTransfer,
      commands: commands.map(cmd => `0x${cmd.slice(2)}`),
      commandsBytes,
      inputs: inputs.map(input => input.slice(0, 10) + "...")
    });
    
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
    const data = iface.encodeFunctionData("execute", [commandsBytes, inputs, deadline]);

    // Determine value (ETH amount if swapping from ETH)
    const value = isEthInput ? amountIn : "0";

    return {
      to: UNIVERSAL_ROUTER_ADDRESS,
      data,
      value
    };
  } catch (error) {
    console.error("Failed to build swap calldata with Permit2:", error);
    throw new Error(`Failed to build swap calldata with Permit2: ${error}`);
  }
}

/**
 * Build V3 path for swap
 * Path encoding: tokenIn (20 bytes) + fee (3 bytes) + tokenOut (20 bytes)
 */
function buildV3Path(tokenIn: Token, tokenOut: Token, fee: FeeAmount): string {
  return ethers.utils.solidityPack(
    ["address", "uint24", "address"],
    [tokenIn.address, fee, tokenOut.address]
  );
}


/**
 * Build ERC20 approval calldata
 * Approve token to Permit2 with max amount
 */
export function buildERC20ApprovalCalldata(
  tokenAddress: string,
  spenderAddress: string
): { to: string; data: string; value: string } | null {
  if (tokenAddress === "0x0000000000000000000000000000000000000000") {
    return null; // ETH doesn't need approval
  }

  // ERC20.approve(spender, max amount) - standard ERC20 approval with max amount
  const erc20ApproveABI = [
    {
      "inputs": [
        {"internalType": "address", "name": "spender", "type": "address"},
        {"internalType": "uint256", "name": "amount", "type": "uint256"}
      ],
      "name": "approve",
      "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];

  const iface = new ethers.utils.Interface(erc20ApproveABI);
  
  // Use max uint256 for approval amount
  const maxAmount = ethers.constants.MaxUint256.toString();
  
  const data = iface.encodeFunctionData("approve", [
    spenderAddress, // spender (Permit2)
    maxAmount       // max amount
  ]);

  return {
    to: tokenAddress, // Call token contract
    data,
    value: "0"
  };
}

/**
 * Build Permit2 approval calldata
 * Approve token to Universal Router via Permit2 with max amount
 */
export function buildApprovalCalldataV3(
  tokenAddress: string,
  spenderAddress: string, // This parameter is now ignored, as spender is hardcoded to UNIVERSAL_ROUTER_ADDRESS
  amount: string // This parameter is now ignored, as maxAmount is used internally
): { to: string; data: string; value: string } | null {
  if (tokenAddress === "0x0000000000000000000000000000000000000000") {
    return null; // ETH doesn't need approval
  }

  // Permit2.approve(token, spender, amount, expiration) - Permit2 approval
  const permit2ApproveABI = [
    {
      "inputs": [
        {"internalType": "address", "name": "token", "type": "address"},
        {"internalType": "address", "name": "spender", "type": "address"},
        {"internalType": "uint160", "name": "amount", "type": "uint160"},
        {"internalType": "uint48", "name": "expiration", "type": "uint48"}
      ],
      "name": "approve",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];

  const iface = new ethers.utils.Interface(permit2ApproveABI);
  
  // Use max uint160 for approval amount (Permit2 uses uint160)
  const maxAmount = "1461501637330902918203684832716283019655932542975"; // 2^160 - 1
  const expiration = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year from now
  
  const data = iface.encodeFunctionData("approve", [
    tokenAddress,           // token
    UNIVERSAL_ROUTER_ADDRESS, // spender (Universal Router)
    maxAmount,             // amount (max uint160)
    expiration             // expiration (1 year)
  ]);

  return {
    to: PERMIT2_ADDRESS, // Call Permit2 contract
    data,
    value: "0"
  };
}

/**
 * Check if token approval is needed
 */
export function isApprovalNeededV3(tokenAddress: string): boolean {
  return tokenAddress !== "0x0000000000000000000000000000000000000000";
}

/**
 * Check Permit2 allowance for a token
 */
export async function checkPermit2Allowance(
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string,
  provider: ethers.providers.Provider
): Promise<{
  amount: string;
  expiration: number;
  nonce: number;
  isValid: boolean;
}> {
  try {
    // Permit2 allowance ABI
    const permit2ABI = [
      {
        "inputs": [
          {"internalType": "address", "name": "owner", "type": "address"},
          {"internalType": "address", "name": "token", "type": "address"},
          {"internalType": "address", "name": "spender", "type": "address"}
        ],
        "name": "allowance",
        "outputs": [
          {"internalType": "uint160", "name": "amount", "type": "uint160"},
          {"internalType": "uint48", "name": "expiration", "type": "uint48"},
          {"internalType": "uint48", "name": "nonce", "type": "uint48"}
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ];

    const permit2Contract = new ethers.Contract(PERMIT2_ADDRESS, permit2ABI, provider);
    
    const [amount, expiration, nonce] = await permit2Contract.allowance(
      ownerAddress,
      tokenAddress,
      spenderAddress
    );

    const currentTime = Math.floor(Date.now() / 1000);
    
    // Safely convert to numbers, handling BigNumber objects
    const expirationNum = typeof expiration === 'object' && expiration.toNumber ? expiration.toNumber() : parseInt(expiration.toString());
    const nonceNum = typeof nonce === 'object' && nonce.toNumber ? nonce.toNumber() : parseInt(nonce.toString());
    
    const isValid = expirationNum > currentTime && amount.gt(0);

    return {
      amount: amount.toString(),
      expiration: expirationNum,
      nonce: nonceNum,
      isValid
    };
  } catch (error) {
    console.error("Failed to check Permit2 allowance:", error);
    return {
      amount: "0",
      expiration: 0,
      nonce: 0,
      isValid: false
    };
  }
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
    // This is a simplified calculation
    // In production, you'd want to calculate the actual price impact
    // based on the pool's current price and the trade size
    const amountInBN = ethers.BigNumber.from(amountIn);
    const amountOutBN = ethers.BigNumber.from(amountOut);
    
    // Check for zero amounts to prevent division by zero
    if (amountInBN.isZero() || amountOutBN.isZero()) {
      return new Percent(0, 10000); // 0% price impact if amounts are zero
    }
    
    // Simple price impact calculation (this is not accurate, just for demo)
    // Calculate as: ((amountIn * 100) / amountOut) - 100
    const priceImpact = amountInBN.mul(100).div(amountOutBN).sub(100);
    
    // Ensure price impact is not negative (shouldn't happen in normal swaps)
    const safePriceImpact = priceImpact.lt(0) ? ethers.BigNumber.from(0) : priceImpact;
    
    return new Percent(safePriceImpact.toString(), 10000);
  } catch (error) {
    console.warn("Price impact calculation failed:", error);
    return new Percent(0, 10000); // 0% price impact if calculation fails
  }
}

/**
 * Get best quote across multiple fee tiers (based on Uniswap reference)
 */
export async function getBestQuoteV3(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  provider: ethers.providers.Provider
): Promise<QuoteResultV3> {
  const feeTiers = [FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH];
  let bestQuote: QuoteResultV3 | null = null;
  let lastError: any = null;

  // Validate input amount
  const amountInBN = ethers.BigNumber.from(amountIn);
  if (amountInBN.isZero()) {
    throw new Error("Input amount cannot be zero");
  }

  for (const fee of feeTiers) {
    try {
      // Try to create trade first to check if pool exists
      const amountInNumber = parseFloat(toReadableAmount(amountIn, tokenIn.decimals));
      
      // Validate amount
      if (amountInNumber <= 0 || !isFinite(amountInNumber)) {
        console.log(`Invalid amount for fee ${fee}:`, amountInNumber);
        continue;
      }
      
      const trade = await createTrade(tokenIn, tokenOut, amountInNumber, fee, provider);
      
      // Validate trade output
      if (!trade || !trade.outputAmount || JSBI.equal(trade.outputAmount.quotient, JSBI.BigInt(0))) {
        console.log(`Invalid trade output for fee ${fee}`);
        continue;
      }
      
      // If trade creation succeeds, create quote result
      const quote: QuoteResultV3 = {
        amountOut: trade.outputAmount.quotient.toString(),
        priceImpact: trade.priceImpact,
        route: `${tokenIn.symbol} → ${tokenOut.symbol} (${fee/10000}% fee)`,
        fee,
        poolAddress: computePoolAddress({
          factoryAddress: POOL_FACTORY_CONTRACT_ADDRESS,
          tokenA: tokenIn,
          tokenB: tokenOut,
          fee
        })
      };
      
      if (!bestQuote || BigInt(quote.amountOut) > BigInt(bestQuote.amountOut)) {
        bestQuote = quote;
      }
    } catch (error) {
      console.log(`Quote failed for fee ${fee}:`, error);
      lastError = error;
      continue;
    }
  }

  if (!bestQuote) {
    throw new Error(`No available pools found for ${tokenIn.symbol}/${tokenOut.symbol} pair. ${lastError?.message || ''}`);
  }

  return bestQuote;
}

/**
 * Estimate gas for swap transaction (Universal Router)
 */
export async function estimateSwapGasV3(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  amountOutMin: string,
  recipient: string,
  fee: FeeAmount,
  slippage: number,
  deadline: number,
  provider: ethers.providers.Provider
): Promise<string> {
  try {
    const calldata = await buildSwapCalldataV3(
      tokenIn,
      tokenOut,
      amountIn,
      amountOutMin,
      recipient,
      fee,
      slippage,
      deadline,
      provider
    );

    const gasEstimate = await provider.estimateGas({
      to: UNIVERSAL_ROUTER_ADDRESS,
      data: calldata.data,
      value: calldata.value
    });

    return gasEstimate.toString();
  } catch (error) {
    console.error("Gas estimation failed:", error);
    return "300000"; // Default gas limit
  }
}

/**
 * Example usage function for Universal Router
 */
export async function exampleUniversalRouterSwap() {
  try {
    // Example: Swap 1 WETH to USDC using Universal Router
    const tokenIn = SEPOLIA_TOKENS_V3.WETH;
    const tokenOut = SEPOLIA_TOKENS_V3.USDC;
    const amountIn = fromReadableAmount(1, 18); // 1 ETH
    const slippage = 0.5; // 0.5%
    const deadline = createDeadline(20); // 20 minutes from now
    const recipient = "0x1234567890123456789012345678901234567890"; // User's address

    // Get quote first
    const quote = await getUniversalRouterQuote(tokenIn, tokenOut, amountIn, null as any);
    
    console.log("Universal Router Quote:", {
      inputAmount: formatAmount(amountIn, tokenIn.decimals),
      outputAmount: formatAmount(quote.amountOut, tokenOut.decimals),
      priceImpact: quote.priceImpact.toFixed(2) + "%",
      route: quote.route,
      fee: quote.fee,
      poolAddress: quote.poolAddress
    });

    // Build Universal Router calldata
    const calldata = await buildUniversalRouterCalldata(
      tokenIn,
      tokenOut,
      amountIn,
      recipient,
      slippage,
      deadline,
      null as any
    );

    console.log("Universal Router calldata:", calldata);
    return calldata;

  } catch (error) {
    console.error("Example Universal Router swap failed:", error);
    throw error;
  }
}
