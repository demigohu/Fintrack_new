# 🔄 FInTrack Protocol - Cross-Chain Bridge & DeFi Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![DFX Version](https://img.shields.io/badge/DFX-1.0-blue.svg)](https://internetcomputer.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.4.6-black.svg)](https://nextjs.org/)
[![Rust](https://img.shields.io/badge/Rust-2021-orange.svg)](https://rust-lang.org/)

**FInTrack Protocol** is a cross-chain bridge and DeFi platform built on top of Internet Computer (IC), enabling users to bridge assets between traditional blockchains (Bitcoin, Ethereum) and Internet Computer through ckBTC and ckETH. The platform provides a complete solution for cross-chain asset management, DeFi operations, and portfolio tracking.

## 🌟 Key Features

### 🔗 Cross-Chain Bridge Operations
- **ckBTC Integration**: Full Bitcoin support through Internet Computer
- **ckETH Integration**: Full Ethereum support with smart contract integration
- **Chain Fusion**: Advanced cross-chain transfer technology for Bitcoin network
- **Native Asset Transfers**: Direct BTC/ETH transfers on native blockchains
- **Fee Preview**: Real-time fee estimation for all transfers

### 💼 Asset Management & Portfolio
- **Real-time Balance Tracking**: Monitor balances across all chains (BTC, ETH, ckBTC, ckETH, ICP)
- **Transaction History**: Complete deposit, withdrawal, and transfer logs with native asset support
- **Portfolio Dashboard**: Visual representation of cross-chain asset distribution
- **Performance Analytics**: Track portfolio performance across different blockchains
- **Native Asset Balances**: Real-time BTC and ETH balances on native blockchains
- **Multi-Chain Transaction View**: Separate tabs for ICP, Ethereum, and Bitcoin transactions

### 🎯 DeFi Features (Coming Soon)
- **ckAsset Swapping**: Swap between different ckAssets (ckBTC ↔ ckETH)


### 🔐 Security & Authentication
- **Internet Identity**: Decentralized authentication via Internet Computer
- **ECDSA Signing**: Secure transaction signing via Internet Computer management canister
- **Multi-Chain Address Derivation**: Deterministic address generation from Principal

## 🎥 Demo Video

Watch FInTrack Protocol in action! See how easy it is to bridge assets between Bitcoin, Ethereum, and Internet Computer.

[![FInTrack Protocol Demo](https://img.shields.io/badge/YouTube-Watch%20Demo-red?style=for-the-badge&logo=youtube)](https://www.youtube.com/watch?v=OlCddZ8Ey-k)

**What you'll see in the demo:**
- 🔗 Cross-chain bridge operations (BTC ↔ ckBTC, ETH ↔ ckETH)
- 💼 Portfolio dashboard with real-time balances
- 📱 User-friendly interface for deposits and withdrawals
- 🚀 Native asset transfers on Bitcoin and Ethereum networks
- 📊 Transaction history across multiple blockchains

## 🏗️ System Architecture

### Backend (Rust + Internet Computer)
```
fintrack_backend/
├── src/
│   ├── lib.rs                 # Main entry point & API endpoints
│   └── services/
│       ├── btc.rs            # Bitcoin bridge service (ckBTC integration)
│       ├── eth.rs            # Ethereum bridge service (ckETH integration)
│       ├── btctransfer.rs    # Native BTC transfer service (Chain Fusion)
│       ├── ethtransfer.rs    # Native ETH transfer service (EVM RPC)
│       ├── transactions.rs   # Transaction management & history with HTTP outcalls
│       ├── rates.rs          # Crypto rates & price feeds
│       ├── address.rs        # Address derivation (ECDSA) for BTC/ETH
│       ├── utils.rs          # Utility functions
│       └── evm_rpc_canister.rs # EVM RPC integration for ETH operations
```

### Frontend (Next.js + TypeScript)
```
fintrack_frontend/
├── src/
│   ├── app/                  # Next.js 15 App Router
│   │   ├── (with-nav)/      # Protected routes with navigation
│   │   │   ├── portfolio/   # Cross-chain portfolio dashboard
│   │   │   ├── deposits/    # Deposit management (BTC/ETH → ckAssets)
│   │   │   ├── withdraw/    # Withdrawal interface (ckAssets → BTC/ETH)
│   │   │   ├── transfer/    # Native BTC/ETH transfer interface
│   │   │   ├── transactions/ # Multi-chain transaction history
│   │   │   └── swap/        # ckAsset swapping (coming soon)
│   │   └── (without-nav)/   # Public routes (login, landing)
│   ├── components/           # Reusable UI components
│   ├── services/             # API integration services
│   ├── hooks/                # Custom React hooks
│   └── contexts/             # React contexts & state management
```

### Blockchain Integration
- **Bitcoin Network**: Native BTC blockchain for deposits, withdrawals, and direct transfers via Chain Fusion
- **Ethereum Network**: Native ETH blockchain for deposits, withdrawals, and direct transfers via EVM RPC
- **Internet Computer (ICP)**: ckAssets (ckBTC, ckETH) and platform services
- **HTTP Outcalls**: Integration with Etherscan (ETH) and BlockCypher (BTC) for transaction history

## 🚀 Getting Started

### Prerequisites
- [DFX](https://internetcomputer.org/docs/current/developer-docs/setup/install/) (Internet Computer SDK)
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Rust](https://rust-lang.org/) (latest stable)
- [Git](https://git-scm.com/)

### Installation

1. **Clone Repository**
```bash
git clone <repository-url>
cd Fintrack_new
```

2. **Install Dependencies**
```bash
# Install Rust dependencies
cargo build

# Install Node.js dependencies
npm install
cd fintrack_frontend && npm install
```

3. **Start Local Development Environment**
```bash
# Start Node Bitcoin Regtest
bitcoind -conf=$(pwd)/bitcoin.conf -datadir=$(pwd)/bitcoin_data --port=18444

# Start Internet Computer replica
dfx start --clean --enable-bitcoin --bitcoin-node 127.0.0.1:18444

# Deploy canisters
dfx deploy

# Set api key for evm_rpc
dfx canister call evm_rpc updateApiKeys '(vec { record { 5 : nat64; opt "YOUR_API" } } )'

dfx canister call evm_rpc updateApiKeys '(vec { record { 9 : nat64; opt "YOUR_API" } } )'
```

## 📱 Usage

### Cross-Chain Bridge Operations
- **BTC Deposits**: Generate BTC address → Send BTC → Receive ckBTC
- **ETH Deposits**: Get Helper Contract address → Send ETH → Receive ckETH
- **Cross-Chain Swapping**: Swap ckETH ↔ ckBTC (DeFi feature)
- **BTC Withdrawals**: Burn ckBTC → Send BTC on Bitcoin Network
- **ETH Withdrawals**: Burn ckETH → Send ETH on Ethereum network
- **Native BTC Transfers**: Direct BTC transfers on Bitcoin network with fee preview
- **Native ETH Transfers**: Direct ETH transfers on Ethereum network with gas estimation

**Complete Cross-Chain Flow Example:**
1. **Deposit ETH** → Get ckETH on Internet Computer
2. **Swap ckETH → ckBTC** → Convert to ckBTC using DeFi protocol
3. **Withdraw ckBTC** → Burn ckBTC → Receive BTC on Bitcoin network

*This enables true cross-chain asset movement: ETH → ckETH → ckBTC → BTC*

### Portfolio Dashboard
- **Cross-Chain Overview**: Total portfolio value across all blockchains
- **Asset Distribution**: Visual representation of BTC, ETH, ckBTC, ckETH holdings
- **Transaction History**: Complete bridge operation logs with status tracking
- **Native Asset Balances**: Real-time BTC and ETH balances on native blockchains
- **Multi-Chain Transaction View**: Separate tabs for ICP, Ethereum, and Bitcoin transactions

### DeFi Features (Coming Soon)
- **ckAsset Swapping**: Swap between ckBTC, ckETH



## 📊 API Reference

### Core Bridge Endpoints

#### Bitcoin Bridge Operations
- `btc_get_deposit_address(owner?, subaccount?)` - Generate BTC deposit address from minter
- `btc_get_balance(owner?, subaccount?)` - Get ckBTC balance
- `btc_transfer(request)` - Transfer BTC via Chain Fusion
- `btc_get_utxos(address)` - Get UTXOs for address
- `btc_get_native_balance(address)` - Get native BTC balance on Bitcoin network
- `btc_preview_fee(destination, amount, owner?)` - Preview BTC transfer fees

#### Ethereum Bridge Operations
- `eth_get_deposit_address(subaccount?)` - Get Helper Contract address
- `eth_get_balance(owner?, subaccount?)` - Get ckETH balance
- `eth_estimate_withdrawal_fee()` - Estimate withdrawal fees
- `eth_get_native_balance(address)` - Get native ETH balance on Ethereum network
- `eth_transfer(destination, amount)` - Transfer ETH on Ethereum network
- `eth_preview_fee(destination, amount, gas_limit?)` - Preview ETH transfer fees

#### Portfolio Management
- `get_user_balances(user)` - Get user balances across all chains including native assets
- `get_transaction_history(user, limit?, offset?)` - Get bridge transaction history with native transactions
- `get_crypto_usd_rate(crypto_id)` - Get current crypto rates
- `btc_derive_address(owner?)` - Derive native BTC address from Principal
- `eth_derive_address(owner?)` - Derive native ETH address from Principal



## 🆕 Recent Updates & Features

### ✅ Implemented Features
- **Native Asset Transfers**: Direct BTC and ETH transfers on native blockchains
- **Fee Preview System**: Real-time fee estimation for BTC and ETH transfers
- **Multi-Chain Transaction History**: Separate tabs for ICP, Ethereum, and Bitcoin transactions
- **HTTP Outcall Integration**: Etherscan API for ETH transaction history, BlockCypher for BTC
- **ECDSA Address Derivation**: Deterministic BTC/ETH address generation from Internet Computer Principal
- **Real-time Balance Updates**: Native BTC and ETH balances integrated into portfolio dashboard

### 🔧 Technical Improvements
- **Stable Storage**: Using `ic-stable-structures` for persistent transaction history
- **EVM RPC Integration**: Direct Ethereum network interaction via EVM RPC canister
- **Chain Fusion Technology**: Advanced Bitcoin transfer protocol with UTXO management
- **Error Handling**: Comprehensive error handling and user feedback
- **Performance Optimization**: Efficient data fetching and caching strategies

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Internet Computer](https://internetcomputer.org/) - Blockchain infrastructure
- [DFX](https://internetcomputer.org/docs/current/developer-docs/setup/install/) - Development framework
- [Next.js](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [Radix UI](https://www.radix-ui.com/) - UI components
- [Etherscan](https://etherscan.io/) - Ethereum API for transaction history
- [BlockCypher](https://www.blockcypher.com/) - Bitcoin API for transaction data

---

**FInTrack Protocol** - Bridging the gap between traditional blockchains and the Internet Computer through innovative Chain Fusion technology.

*Empowering seamless cross-chain DeFi operations with security and efficiency*

*Built with ❤️ on the Internet Computer*
