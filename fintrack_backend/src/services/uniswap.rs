use candid::{CandidType, Deserialize, Nat, Principal};
use ic_cdk::api::call::call_with_payment128;
use ic_cdk::api::management_canister::ecdsa::{
    ecdsa_public_key, EcdsaPublicKeyArgument, EcdsaPublicKeyResponse, EcdsaKeyId, EcdsaCurve, SignWithEcdsaArgument
};
use ic_secp256k1::{PublicKey, DerivationPath, RecoveryId};
use ic_ethereum_types::Address;
use alloy_consensus::{SignableTransaction, TxEip1559, TxEnvelope};
use alloy_primitives::{hex, Signature, TxKind, U256, Bytes};
use super::evm_rpc_canister::{
    BlockTag, EthSepoliaService, GetTransactionCountArgs,
    GetTransactionCountResult, MultiGetTransactionCountResult, RpcServices, RpcConfig, RpcService
};

use num_traits::Zero;
use std::str::FromStr;

// Constants
const DEFAULT_ECDSA_KEY_NAME: &str = "dfx_test_key"; // Use "test_key_1" or "key_1" on IC
const SEPOLIA_CHAIN_ID: u64 = 11155111;

// EVM RPC Canister ID: xhcuo-6yaaa-aaaar-qacqq-cai
fn get_evm_rpc_canister_id() -> Principal {
    Principal::from_text("xhcuo-6yaaa-aaaar-qacqq-cai").unwrap()
}

// Input struct for frontend
#[derive(CandidType, Deserialize, Debug)]
pub struct TxRequest {
    pub to: String,           // Universal Router address
    pub data: String,         // ABI encoded calldata from FE
    pub value: Option<u128>,  // ETH to send (optional)
    pub owner: Option<Principal>, // Optional owner, defaults to caller
}

// Response struct
#[derive(CandidType, Deserialize, Debug)]
pub struct UniswapTxResponse {
    pub success: bool,
    pub transaction_hash: Option<String>,
    pub error: Option<String>,
}

// ECDSA Public Key implementation (reused from ethtransfer.rs)
#[derive(Debug, PartialEq, Eq, Clone)]
pub struct EcdsaPublicKey {
    public_key: PublicKey,
    chain_code: Vec<u8>,
}

impl EcdsaPublicKey {
    pub fn derive_new_public_key(
        &self,
        derivation_path: &DerivationPath,
    ) -> Self {
        let (dk, cc) = self.public_key.derive_subkey(derivation_path);
        Self {
            public_key: dk,
            chain_code: cc.to_vec(),
        }
    }
}

impl AsRef<PublicKey> for EcdsaPublicKey {
    fn as_ref(&self) -> &PublicKey {
        &self.public_key
    }
}

impl From<EcdsaPublicKeyResponse> for EcdsaPublicKey {
    fn from(value: EcdsaPublicKeyResponse) -> Self {
        EcdsaPublicKey {
            public_key: PublicKey::deserialize_sec1(&value.public_key)
                .expect("BUG: invalid public key"),
            chain_code: value.chain_code,
        }
    }
}

impl From<&EcdsaPublicKey> for Address {
    fn from(value: &EcdsaPublicKey) -> Self {
        let key_bytes = value.as_ref().serialize_sec1(/*compressed=*/ false);
        debug_assert_eq!(key_bytes[0], 0x04);
        let hash = ic_sha3::Keccak256::hash(&key_bytes[1..]);
        let mut addr = [0u8; 20];
        addr[..].copy_from_slice(&hash[12..32]);
        Address::new(addr)
    }
}

// Ethereum Wallet implementation (reused from ethtransfer.rs)
#[derive(Debug, PartialEq, Eq, Clone)]
pub struct EthereumWallet {
    owner: Principal,
    derived_public_key: EcdsaPublicKey,
}

impl EthereumWallet {
    pub async fn new(owner: Principal) -> Self {
        let args = EcdsaPublicKeyArgument {
            canister_id: None,
            derivation_path: principal_derivation_path(&owner),
            key_id: EcdsaKeyId {
                curve: EcdsaCurve::Secp256k1,
                name: DEFAULT_ECDSA_KEY_NAME.to_string(),
            },
        };
        let (res,) = ecdsa_public_key(args)
            .await
            .unwrap_or_else(|(error_code, message)| {
                ic_cdk::trap(&format!(
                    "failed to get canister's public key: {} (error code = {:?})",
                    message, error_code,
                ))
            });
        let derived_public_key = EcdsaPublicKey::from(res);
        Self {
            owner,
            derived_public_key,
        }
    }

    pub fn ethereum_address(&self) -> Address {
        Address::from(&self.derived_public_key)
    }

    pub async fn sign_with_ecdsa(&self, message_hash: [u8; 32]) -> ([u8; 64], RecoveryId) {
        let derivation_path = principal_derivation_path(&self.owner);
        let key_id = EcdsaKeyId {
            curve: EcdsaCurve::Secp256k1,
            name: DEFAULT_ECDSA_KEY_NAME.to_string(),
        };
        let (result,) = ic_cdk::api::management_canister::ecdsa::sign_with_ecdsa(SignWithEcdsaArgument {
            message_hash: message_hash.to_vec(),
            derivation_path,
            key_id,
        })
        .await
        .expect("failed to sign with ecdsa");

        let signature_length = result.signature.len();
        let signature = <[u8; 64]>::try_from(result.signature).unwrap_or_else(|_| {
            panic!(
                "BUG: invalid signature from management canister. Expected 64 bytes but got {} bytes",
                signature_length
            )
        });
        let recovery_id = self.compute_recovery_id(&message_hash, &signature);
        if recovery_id.is_x_reduced() {
            ic_cdk::trap("BUG: affine x-coordinate of r is reduced which is so unlikely to happen that it's probably a bug");
        }
        (signature, recovery_id)
    }

    fn compute_recovery_id(&self, message_hash: &[u8], signature: &[u8]) -> RecoveryId {
        use alloy_primitives::hex;
        
        ic_cdk::println!("Verifying signature:");
        ic_cdk::println!("  Message hash: 0x{}", hex::encode(message_hash));
        ic_cdk::println!("  Signature: 0x{}", hex::encode(signature));
        ic_cdk::println!("  Public key: 0x{}", hex::encode(self.as_ref().serialize_sec1(true)));
        
        let verification_result = self.as_ref()
            .try_recovery_from_digest(message_hash, signature)
            .unwrap_or_else(|e| {
                panic!(
                    "BUG: failed to recover public key {:?} from digest {:?} and signature {:?}: {:?}",
                    hex::encode(self.as_ref().serialize_sec1(true)),
                    hex::encode(message_hash),
                    hex::encode(signature),
                    e
                )
            });
        
        verification_result
    }
}

impl AsRef<PublicKey> for EthereumWallet {
    fn as_ref(&self) -> &PublicKey {
        self.derived_public_key.as_ref()
    }
}

// Helper functions
fn principal_derivation_path(owner: &Principal) -> Vec<Vec<u8>> {
    vec![owner.as_slice().to_vec()]
}

// Get transaction count (nonce) - reused from ethtransfer.rs
pub async fn get_transaction_count(owner: Option<Principal>, block: Option<BlockTag>) -> u64 {
    let owner = owner.unwrap_or_else(ic_cdk::caller);
    let wallet = EthereumWallet::new(owner).await;
    let rpc_services = RpcServices::EthSepolia(Some(vec![EthSepoliaService::PublicNode]));
    
    let args = GetTransactionCountArgs {
        address: wallet.ethereum_address().to_string(),
        block: block.unwrap_or(BlockTag::Finalized),
    };

    let cycles = 5_000_000_000_u128;
    let (result,) = call_with_payment128(
        get_evm_rpc_canister_id(),
        "eth_getTransactionCount",
        (rpc_services, None::<Option<RpcConfig>>, args),
        cycles,
    )
    .await
    .unwrap_or_else(|e| {
        panic!(
            "failed to get transaction count for address {}, error: {:?}",
            wallet.ethereum_address(), e
        )
    });

    match result {
        MultiGetTransactionCountResult::Consistent(consistent_result) => {
            match consistent_result {
                GetTransactionCountResult::Ok(count) => nat_to_u64(count),
                GetTransactionCountResult::Err(_error) => {
                    ic_cdk::trap("failed to get transaction count")
                }
            }
        }
        MultiGetTransactionCountResult::Inconsistent(inconsistent_results) => {
            ic_cdk::trap(&format!(
                "inconsistent results when retrieving transaction count. Received results: {}",
                inconsistent_results.len()
            ))
        }
    }
}

// Estimate gas and fees for Uniswap transactions
fn estimate_uniswap_fees() -> (u128, u128, u128) {
    const GAS_LIMIT: u128 = 300_000; // Higher gas limit for Uniswap interactions
    const MAX_FEE_PER_GAS: u128 = 50_000_000_000; // 50 gwei
    const MAX_PRIORITY_FEE_PER_GAS: u128 = 2_000_000_000; // 2 gwei
    (GAS_LIMIT, MAX_FEE_PER_GAS, MAX_PRIORITY_FEE_PER_GAS)
}

// Helper function to convert Nat to u64
fn nat_to_u64(nat: Nat) -> u64 {
    use num_traits::cast::ToPrimitive;
    nat.0
        .to_u64()
        .unwrap_or_else(|| ic_cdk::trap(&format!("Nat {} doesn't fit into a u64", nat)))
}

// Helper function to convert u128 to U256
fn u128_to_u256(value: u128) -> U256 {
    U256::from(value)
}

// Main function to send Uniswap transaction
pub async fn send_uniswap_tx(req: TxRequest) -> Result<String, String> {
    ic_cdk::println!("Starting Uniswap transaction:");
    ic_cdk::println!("  To: {}", req.to);
    ic_cdk::println!("  Data: {}", req.data);
    ic_cdk::println!("  Value: {:?}", req.value);

    // Validate input
    let to_address = Address::from_str(&req.to)
        .map_err(|e| format!("Invalid 'to' address: {}", e))?;

    // Parse calldata
    let calldata = if req.data.starts_with("0x") {
        hex::decode(&req.data[2..])
            .map_err(|e| format!("Invalid hex data: {}", e))?
    } else {
        hex::decode(&req.data)
            .map_err(|e| format!("Invalid hex data: {}", e))?
    };

    // Get owner (caller if not specified)
    let owner = req.owner.unwrap_or_else(ic_cdk::caller);

    // Get nonce for the owner
    let nonce = get_transaction_count(Some(owner), Some(BlockTag::Pending)).await;

    // Estimate gas and fees
    let (gas_limit, max_fee_per_gas, max_priority_fee_per_gas) = estimate_uniswap_fees();

    // Build EIP-1559 transaction
    let transaction = TxEip1559 {
        chain_id: SEPOLIA_CHAIN_ID,
        nonce,
        gas_limit,
        max_fee_per_gas,
        max_priority_fee_per_gas,
        to: TxKind::Call(alloy_primitives::Address::from_str(&req.to).unwrap()),
        value: u128_to_u256(req.value.unwrap_or(0)),
        access_list: Default::default(),
        input: Bytes::from(calldata),
    };

    ic_cdk::println!("Transaction built:");
    ic_cdk::println!("  Chain ID: {}", SEPOLIA_CHAIN_ID);
    ic_cdk::println!("  Nonce: {}", nonce);
    ic_cdk::println!("  Gas Limit: {}", gas_limit);
    ic_cdk::println!("  Max Fee Per Gas: {}", max_fee_per_gas);
    ic_cdk::println!("  Max Priority Fee Per Gas: {}", max_priority_fee_per_gas);
    ic_cdk::println!("  Value: {}", req.value.unwrap_or(0));

    // Sign transaction
    let wallet = EthereumWallet::new(owner).await;
    let tx_hash = transaction.signature_hash().0;
    
    ic_cdk::println!("Transaction hash to sign: 0x{}", hex::encode(tx_hash));
    ic_cdk::println!("Wallet ethereum address: {}", wallet.ethereum_address());
    
    let (raw_signature, recovery_id) = wallet.sign_with_ecdsa(tx_hash).await;
    let signature = Signature::from_bytes_and_parity(&raw_signature, recovery_id.is_y_odd())
        .expect("BUG: failed to create a signature");
    let signed_tx = transaction.into_signed(signature);

    // Encode transaction
    let raw_transaction_hash = *signed_tx.hash();
    let mut tx_bytes: Vec<u8> = vec![];
    use alloy_eips::eip2718::Encodable2718;
    TxEnvelope::from(signed_tx).encode_2718(&mut tx_bytes);
    let raw_transaction_hex = format!("0x{}", hex::encode(&tx_bytes));

    ic_cdk::println!(
        "Sending raw transaction hex {} with transaction hash {}",
        raw_transaction_hex, raw_transaction_hash
    );

    // Send transaction via EVM RPC
    let rpc_services = RpcServices::EthSepolia(Some(vec![EthSepoliaService::PublicNode]));
    let cycles = 5_000_000_000_u128;
    let (result,) = call_with_payment128(
        get_evm_rpc_canister_id(),
        "eth_sendRawTransaction",
        (rpc_services, None::<Option<RpcConfig>>, raw_transaction_hex.clone()),
        cycles,
    )
    .await
    .map_err(|e| format!("Failed to send transaction: {:?}", e))?;

    match result {
        super::evm_rpc_canister::MultiSendRawTransactionResult::Consistent(send_result) => {
            match send_result {
                super::evm_rpc_canister::SendRawTransactionResult::Ok(hash) => {
                    match hash {
                        super::evm_rpc_canister::SendRawTransactionStatus::Ok(Some(tx_hash)) => {
                            ic_cdk::println!("Transaction sent successfully: {}", tx_hash);
                            Ok(tx_hash)
                        }
                        super::evm_rpc_canister::SendRawTransactionStatus::Ok(None) => {
                            ic_cdk::println!("Transaction sent successfully (no hash returned)");
                            Ok("Transaction sent successfully".to_string())
                        }
                        super::evm_rpc_canister::SendRawTransactionStatus::NonceTooLow => {
                            Err("Nonce too low".to_string())
                        }
                        super::evm_rpc_canister::SendRawTransactionStatus::NonceTooHigh => {
                            Err("Nonce too high".to_string())
                        }
                        super::evm_rpc_canister::SendRawTransactionStatus::InsufficientFunds => {
                            Err("Insufficient funds".to_string())
                        }
                    }
                }
                super::evm_rpc_canister::SendRawTransactionResult::Err(_error) => {
                    Err("Transaction failed".to_string())
                }
            }
        }
        super::evm_rpc_canister::MultiSendRawTransactionResult::Inconsistent(_) => {
            Err("Inconsistent RPC response".to_string())
        }
    }
}

// Alternative function that returns structured response
pub async fn send_uniswap_tx_with_response(req: TxRequest) -> Result<UniswapTxResponse, String> {
    match send_uniswap_tx(req).await {
        Ok(tx_hash) => Ok(UniswapTxResponse {
            success: true,
            transaction_hash: Some(tx_hash),
            error: None,
        }),
        Err(error) => Ok(UniswapTxResponse {
            success: false,
            transaction_hash: None,
            error: Some(error),
        }),
    }
}

// Function to send approval transaction (same as send_uniswap_tx but for approval)
pub async fn send_approval_tx(req: TxRequest) -> Result<String, String> {
    ic_cdk::println!("Starting approval transaction:");
    ic_cdk::println!("  To: {}", req.to);
    ic_cdk::println!("  Data: {}", req.data);
    ic_cdk::println!("  Value: {:?}", req.value);

    // Validate input
    let to_address = Address::from_str(&req.to)
        .map_err(|e| format!("Invalid 'to' address: {}", e))?;

    // Parse calldata
    let calldata = if req.data.starts_with("0x") {
        hex::decode(&req.data[2..])
            .map_err(|e| format!("Invalid hex data: {}", e))?
    } else {
        hex::decode(&req.data)
            .map_err(|e| format!("Invalid hex data: {}", e))?
    };

    // Get owner (caller if not specified)
    let owner = req.owner.unwrap_or_else(ic_cdk::caller);

    // Get nonce for the owner
    let nonce = get_transaction_count(Some(owner), Some(BlockTag::Pending)).await;

    // Estimate gas and fees (approval typically needs less gas)
    let (gas_limit, max_fee_per_gas, max_priority_fee_per_gas) = estimate_approval_fees();

    // Build EIP-1559 transaction
    let transaction = TxEip1559 {
        chain_id: SEPOLIA_CHAIN_ID,
        nonce,
        gas_limit,
        max_fee_per_gas,
        max_priority_fee_per_gas,
        to: TxKind::Call(alloy_primitives::Address::from_str(&req.to).unwrap()),
        value: u128_to_u256(req.value.unwrap_or(0)),
        access_list: Default::default(),
        input: Bytes::from(calldata),
    };

    ic_cdk::println!("Approval transaction built:");
    ic_cdk::println!("  Chain ID: {}", SEPOLIA_CHAIN_ID);
    ic_cdk::println!("  Nonce: {}", nonce);
    ic_cdk::println!("  Gas Limit: {}", gas_limit);
    ic_cdk::println!("  Max Fee Per Gas: {}", max_fee_per_gas);
    ic_cdk::println!("  Max Priority Fee Per Gas: {}", max_priority_fee_per_gas);
    ic_cdk::println!("  Value: {}", req.value.unwrap_or(0));

    // Sign transaction
    let wallet = EthereumWallet::new(owner).await;
    let tx_hash = transaction.signature_hash().0;
    
    ic_cdk::println!("Approval transaction hash to sign: 0x{}", hex::encode(tx_hash));
    ic_cdk::println!("Wallet ethereum address: {}", wallet.ethereum_address());
    
    let (raw_signature, recovery_id) = wallet.sign_with_ecdsa(tx_hash).await;
    let signature = Signature::from_bytes_and_parity(&raw_signature, recovery_id.is_y_odd())
        .expect("BUG: failed to create a signature");
    let signed_tx = transaction.into_signed(signature);

    // Encode transaction
    let raw_transaction_hash = *signed_tx.hash();
    let mut tx_bytes: Vec<u8> = vec![];
    use alloy_eips::eip2718::Encodable2718;
    TxEnvelope::from(signed_tx).encode_2718(&mut tx_bytes);
    let raw_transaction_hex = format!("0x{}", hex::encode(&tx_bytes));

    ic_cdk::println!(
        "Sending approval raw transaction hex {} with transaction hash {}",
        raw_transaction_hex, raw_transaction_hash
    );

    // Send transaction via EVM RPC
    let rpc_services = RpcServices::EthSepolia(Some(vec![EthSepoliaService::PublicNode]));
    let cycles = 5_000_000_000_u128;
    let (result,) = call_with_payment128(
        get_evm_rpc_canister_id(),
        "eth_sendRawTransaction",
        (rpc_services, None::<Option<RpcConfig>>, raw_transaction_hex.clone()),
        cycles,
    )
    .await
    .map_err(|e| format!("Failed to send approval transaction: {:?}", e))?;

    match result {
        super::evm_rpc_canister::MultiSendRawTransactionResult::Consistent(send_result) => {
            match send_result {
                super::evm_rpc_canister::SendRawTransactionResult::Ok(hash) => {
                    match hash {
                        super::evm_rpc_canister::SendRawTransactionStatus::Ok(Some(tx_hash)) => {
                            ic_cdk::println!("Approval transaction sent successfully: {}", tx_hash);
                            Ok(tx_hash)
                        }
                        super::evm_rpc_canister::SendRawTransactionStatus::Ok(None) => {
                            ic_cdk::println!("Approval transaction sent successfully (no hash returned)");
                            Ok("Approval transaction sent successfully".to_string())
                        }
                        super::evm_rpc_canister::SendRawTransactionStatus::NonceTooLow => {
                            Err("Nonce too low".to_string())
                        }
                        super::evm_rpc_canister::SendRawTransactionStatus::NonceTooHigh => {
                            Err("Nonce too high".to_string())
                        }
                        super::evm_rpc_canister::SendRawTransactionStatus::InsufficientFunds => {
                            Err("Insufficient funds".to_string())
                        }
                    }
                }
                super::evm_rpc_canister::SendRawTransactionResult::Err(_error) => {
                    Err("Approval transaction failed".to_string())
                }
            }
        }
        super::evm_rpc_canister::MultiSendRawTransactionResult::Inconsistent(_) => {
            Err("Inconsistent RPC response".to_string())
        }
    }
}

// Estimate gas and fees for approval transactions (lower than swap)
fn estimate_approval_fees() -> (u128, u128, u128) {
    const GAS_LIMIT: u128 = 100_000; // Lower gas limit for approval
    const MAX_FEE_PER_GAS: u128 = 50_000_000_000; // 50 gwei
    const MAX_PRIORITY_FEE_PER_GAS: u128 = 2_000_000_000; // 2 gwei
    (GAS_LIMIT, MAX_FEE_PER_GAS, MAX_PRIORITY_FEE_PER_GAS)
}

// Function to get fresh nonce after approval
pub async fn get_fresh_nonce(owner: Option<Principal>) -> Result<u64, String> {
    let owner = owner.unwrap_or_else(ic_cdk::caller);
    let nonce = get_transaction_count(Some(owner), Some(BlockTag::Pending)).await;
    Ok(nonce)
}

// Helper function to get current gas price for fee estimation
pub async fn get_current_gas_price() -> Result<u128, String> {
    let gas_price_json = r#"{"jsonrpc":"2.0","method":"eth_gasPrice","params":[],"id":1}"#;
    let max_response_size_bytes = 500_u64;
    let cycles = 5_000_000_000u128;
    let rpc_service = RpcService::EthSepolia(EthSepoliaService::PublicNode);

    let (gas_price_response,) = call_with_payment128(
        get_evm_rpc_canister_id(),
        "request",
        (RpcService::EthSepolia(EthSepoliaService::PublicNode), gas_price_json.to_string(), max_response_size_bytes),
        cycles,
    )
    .await
    .map_err(|e| format!("Failed to get gas price: {:?}", e))?;

    match gas_price_response {
        super::evm_rpc_canister::RequestResult::Ok(result) => {
            let response: serde_json::Value = serde_json::from_str(&result)
                .map_err(|e| format!("Failed to parse gas price response: {}", e))?;
            
            let hex_gas_price = response
                .get("result")
                .and_then(|v| v.as_str())
                .ok_or("No result in gas price response")?;

            let gas_price_hex = hex_gas_price.trim_start_matches("0x");
            u128::from_str_radix(gas_price_hex, 16)
                .map_err(|e| format!("Failed to parse hex gas price: {}", e))
        }
        super::evm_rpc_canister::RequestResult::Err(_) => {
            Err("Failed to get gas price".to_string())
        }
    }
}