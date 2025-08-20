# 🔄 FInTrack Protocol - Cross-Chain Bridge & DeFi Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![DFX Version](https://img.shields.io/badge/DFX-1.0-blue.svg)](https://internetcomputer.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.4.6-black.svg)](https://nextjs.org/)
[![Rust](https://img.shields.io/badge/Rust-2021-orange.svg)](https://rust-lang.org/)

**FInTrack Protocol** adalah platform cross-chain bridge dan DeFi yang dibangun di atas Internet Computer (IC), memungkinkan pengguna untuk melakukan bridge aset antara blockchain tradisional (Bitcoin, Ethereum) dan Internet Computer melalui ckBTC dan ckETH. Platform ini menyediakan solusi lengkap untuk cross-chain asset management, DeFi operations, dan portfolio tracking.

## 🌟 Fitur Utama

### 🔗 Cross-Chain Bridge Operations
- **BTC Bridge**: Deposit BTC → Convert to ckBTC → Transfer via Chain Fusion
- **ETH Bridge**: Deposit ETH → Convert to ckETH → Transfer on Ethereum network
- **ckBTC Integration**: Full Bitcoin support through Internet Computer
- **ckETH Integration**: Full Ethereum support with smart contract integration
- **Chain Fusion**: Advanced cross-chain transfer technology for Bitcoin network

### 💼 Asset Management & Portfolio
- **Real-time Balance Tracking**: Monitor balances across all chains (BTC, ETH, ckBTC, ckETH, ICP)
- **Transaction History**: Complete deposit, withdrawal, and transfer logs
- **Portfolio Dashboard**: Visual representation of cross-chain asset distribution
- **Performance Analytics**: Track portfolio performance across different blockchains

### 🎯 DeFi Features (Coming Soon)
- **ckAsset Swapping**: Swap between different ckAssets (ckBTC ↔ ckETH)


### 🔐 Security & Authentication
- **Internet Identity**: Decentralized authentication via Internet Computer


## 🏗️ Arsitektur Sistem

### Backend (Rust + Internet Computer)
```
fintrack_backend/
├── src/
│   ├── lib.rs                 # Main entry point & API endpoints
│   └── services/
│       ├── btc.rs            # Bitcoin bridge service (ckBTC integration)
│       ├── eth.rs            # Ethereum bridge service (ckETH integration)
│       ├── transfer.rs       # Cross-chain transfer logic & Chain Fusion
│       ├── transactions.rs   # Transaction management & history
│       ├── rates.rs          # Crypto rates & price feeds
│       ├── address.rs        # Address derivation (ECDSA)
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
│   │   │   ├── bridge/      # Bridge operations interface
│   │   │   ├── deposits/    # Deposit management (BTC/ETH → ckAssets)
│   │   │   ├── withdraw/    # Withdrawal interface (ckAssets → BTC/ETH)
│   │   │   └── swap/        # ckAsset swapping (coming soon)
│   │   └── (without-nav)/   # Public routes (login, landing)
│   ├── components/           # Reusable UI components
│   ├── services/             # API integration services
│   ├── hooks/                # Custom React hooks
│   └── contexts/             # React contexts & state management
```

### Blockchain Integration
- **Bitcoin Network**: Native BTC blockchain for deposits and withdrawals Powered by Chain Fusion
- **Ethereum Network**: Native ETH blockchain for deposits and withdrawals Powered by Chain Fusion
- **Internet Computer (ICP)**: ckAssets (ckBTC, ckETH) and platform services

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

# Start frontend development server
npm run dev
```

## 📱 Usage

### Cross-Chain Bridge Operations
- **BTC Deposits**: Generate BTC address → Send BTC → Receive ckBTC
- **ETH Deposits**: Get Helper Contract address → Send ETH → Receive ckETH
- **Cross-Chain Swapping**: Swap ckETH ↔ ckBTC (DeFi feature)
- **BTC Withdrawals**: Burn ckBTC → Send BTC on Bitcoin Network
- **ETH Withdrawals**: Burn ckETH → Send ETH on Ethereum network

**Complete Cross-Chain Flow Example:**
1. **Deposit ETH** → Get ckETH on Internet Computer
2. **Swap ckETH → ckBTC** → Convert to ckBTC using DeFi protocol
3. **Withdraw ckBTC** → Burn ckBTC → Receive BTC on Bitcoin network

*This enables true cross-chain asset movement: ETH → ckETH → ckBTC → BTC*

### Portfolio Dashboard
- **Cross-Chain Overview**: Total portfolio value across all blockchains
- **Asset Distribution**: Visual representation of BTC, ETH, ckBTC, ckETH holdings
- **Transaction History**: Complete bridge operation logs with status tracking

### DeFi Features (Coming Soon)
- **ckAsset Swapping**: Swap between ckBTC, ckETH



## 📊 API Reference

### Core Bridge Endpoints

#### Bitcoin Bridge Operations
- `btc_get_deposit_address(owner?, subaccount?)` - Generate BTC deposit address from minter
- `btc_get_balance(owner?, subaccount?)` - Get ckBTC balance
- `btc_transfer(request)` - Transfer BTC via Chain Fusion
- `btc_get_utxos(address)` - Get UTXOs for address

#### Ethereum Bridge Operations
- `eth_get_deposit_address(subaccount?)` - Get Helper Contract address
- `eth_get_balance(owner?, subaccount?)` - Get ckETH balance
- `eth_estimate_withdrawal_fee()` - Estimate withdrawal fees

#### Portfolio Management
- `get_user_balances(user)` - Get user balances across all chains
- `get_transaction_history(user, limit?, offset?)` - Get bridge transaction history
- `get_crypto_usd_rate(crypto_id)` - Get current crypto rates



## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Internet Computer](https://internetcomputer.org/) - Blockchain infrastructure
- [DFX](https://internetcomputer.org/docs/current/developer-docs/setup/install/) - Development framework
- [Next.js](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [Radix UI](https://www.radix-ui.com/) - UI components

---

**FInTrack Protocol** - Bridging the gap between traditional blockchains and the Internet Computer through innovative Chain Fusion technology.

*Empowering seamless cross-chain DeFi operations with security and efficiency*

*Built with ❤️ on the Internet Computer*
