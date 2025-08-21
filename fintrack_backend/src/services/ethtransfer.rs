use candid::{CandidType, Deserialize, Nat, Principal};
use ic_cdk::init;
use ic_cdk::api::call::call_with_payment128;
use ic_cdk::api::management_canister::ecdsa::{
    ecdsa_public_key, EcdsaPublicKeyArgument, EcdsaPublicKeyResponse, EcdsaKeyId, EcdsaCurve, SignWithEcdsaArgument
};
use ic_secp256k1::{PublicKey, DerivationPath, RecoveryId};
use ic_ethereum_types::Address;
use alloy_consensus::{SignableTransaction, TxEip1559, TxEnvelope};
use alloy_primitives::{hex, Signature, TxKind, U256};
use super::evm_rpc_canister::{
    BlockTag, EthSepoliaService, GetTransactionCountArgs,
    GetTransactionCountResult, MultiGetTransactionCountResult, RpcServices, RpcConfig, RpcService
};

use num_traits::Zero;
use std::str::FromStr;

// Constants
const DEFAULT_ECDSA_KEY_NAME: &str = "dfx_test_key"; // Use "test_key_1" or "key_1" on IC
// EVM RPC Canister ID: xhcuo-6yaaa-aaaar-qacqq-cai
fn get_evm_rpc_canister_id() -> Principal {
    Principal::from_text("xhcuo-6yaaa-aaaar-qacqq-cai").unwrap()
}

// Types
#[derive(CandidType, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum EthereumNetwork {
    Mainnet,
    Sepolia,
    Local, // For local development
}

impl Default for EthereumNetwork {
    fn default() -> Self {
        EthereumNetwork::Sepolia
    }
}

impl EthereumNetwork {
    pub fn chain_id(&self) -> u64 {
        match self {
            EthereumNetwork::Mainnet => 1,
            EthereumNetwork::Sepolia => 11155111,
            EthereumNetwork::Local => 31337, // Local hardhat/ganache
        }
    }
}

#[derive(CandidType, Deserialize)]
pub struct EthTransferRequest {
    pub destination_address: String,
    pub amount: Nat,
    pub owner: Option<Principal>,
    pub gas_limit: Option<u128>,
    pub max_fee_per_gas: Option<u128>,
    pub max_priority_fee_per_gas: Option<u128>,
}

#[derive(CandidType, Deserialize)]
pub struct EthTransferResponse {
    pub success: bool,
    pub transaction_hash: Option<String>,
    pub error: Option<String>,
}

#[derive(CandidType, Deserialize)]
pub struct EthFeePreview {
    pub estimated_gas_limit: u128,
    pub base_fee_per_gas: u128,
    pub max_priority_fee_per_gas: u128,
    pub max_fee_per_gas: u128,
    pub total_fee_wei: u128,
    pub total_fee_eth: f64,
    pub gas_price: u128,
    pub transaction_speed: String, // "slow", "medium", "fast"
}

// ECDSA Public Key implementation
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

// Ethereum Wallet implementation
#[derive(Debug, PartialEq, Eq, Clone)]
pub struct EthereumWallet {
    owner: Principal,
    derived_public_key: EcdsaPublicKey,
}

impl EthereumWallet {
    pub async fn new(owner: Principal) -> Self {
        // Ambil public key dengan derivation path principal user
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

// Helper functions - Use same logic as address.rs


fn principal_derivation_path(owner: &Principal) -> Vec<Vec<u8>> {
    vec![owner.as_slice().to_vec()] // Same as address.rs
}



// Main transfer function
pub async fn transfer_eth(request: EthTransferRequest) -> Result<EthTransferResponse, String> {
    // Validate amount
    if request.amount.0.is_zero() {
        return Err("Amount cannot be zero".to_string());
    }

    // Parse destination address
    let _to_address = Address::from_str(&request.destination_address)
        .map_err(|e| format!("Invalid destination address: {}", e))?;

    // Get owner (caller if not specified)
    let owner = request.owner.unwrap_or_else(ic_cdk::caller);

    // Get nonce for the owner
    let nonce = get_transaction_count(Some(owner), Some(BlockTag::Latest)).await;

    // Estimate gas and fees
    let (gas_limit, max_fee_per_gas, max_priority_fee_per_gas) = estimate_transaction_fees();

    // Build EIP-1559 transaction
    let transaction = TxEip1559 {
        chain_id: EthereumNetwork::Sepolia.chain_id(), // Use dynamic chain ID
        nonce,
        gas_limit,
        max_fee_per_gas,
        max_priority_fee_per_gas,
        to: TxKind::Call(alloy_primitives::Address::from_str(&request.destination_address).unwrap()),
        value: nat_to_u256(request.amount),
        access_list: Default::default(),
        input: Default::default(),
    };

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
                            Ok(EthTransferResponse {
                                success: true,
                                transaction_hash: Some(tx_hash),
                                error: None,
                            })
                        }
                        super::evm_rpc_canister::SendRawTransactionStatus::Ok(None) => {
                            Ok(EthTransferResponse {
                                success: true,
                                transaction_hash: Some("Transaction sent successfully".to_string()),
                                error: None,
                            })
                        }
                        super::evm_rpc_canister::SendRawTransactionStatus::NonceTooLow => {
                            Ok(EthTransferResponse {
                                success: false,
                                transaction_hash: None,
                                error: Some("Nonce too low".to_string()),
                            })
                        }
                        super::evm_rpc_canister::SendRawTransactionStatus::NonceTooHigh => {
                            Ok(EthTransferResponse {
                                success: false,
                                transaction_hash: None,
                                error: Some("Nonce too high".to_string()),
                            })
                        }
                        super::evm_rpc_canister::SendRawTransactionStatus::InsufficientFunds => {
                            Ok(EthTransferResponse {
                                success: false,
                                transaction_hash: None,
                                error: Some("Insufficient funds".to_string()),
                            })
                        }
                    }
                }
                super::evm_rpc_canister::SendRawTransactionResult::Err(_error) => {
                    Ok(EthTransferResponse {
                        success: false,
                        transaction_hash: None,
                        error: Some("Transaction failed".to_string()),
                    })
                }
            }
        }
        super::evm_rpc_canister::MultiSendRawTransactionResult::Inconsistent(_) => {
            Ok(EthTransferResponse {
                success: false,
                transaction_hash: None,
                error: Some("Inconsistent RPC response".to_string()),
            })
        }
    }
}

// Preview fee for ETH transfer
pub async fn preview_eth_fee(
    destination_address: String,
    amount: Nat,
    gas_limit: Option<u128>,
) -> Result<EthFeePreview, String> {
    // Get current gas price
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

    let gas_price = match gas_price_response {
        super::evm_rpc_canister::RequestResult::Ok(result) => {
            let response: serde_json::Value = serde_json::from_str(&result)
                .map_err(|e| format!("Failed to parse gas price response: {}", e))?;
            
            let hex_gas_price = response
                .get("result")
                .and_then(|v| v.as_str())
                .ok_or("No result in gas price response")?;

            let gas_price_hex = hex_gas_price.trim_start_matches("0x");
            u128::from_str_radix(gas_price_hex, 16)
                .map_err(|e| format!("Failed to parse hex gas price: {}", e))?
        }
        super::evm_rpc_canister::RequestResult::Err(_) => {
            return Err("Failed to get gas price".to_string());
        }
    };

    // Get base fee from latest block
    let base_fee_json = r#"{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["latest",false],"id":1}"#;
    
    let (base_fee_response,) = call_with_payment128(
        get_evm_rpc_canister_id(),
        "request",
        (RpcService::EthSepolia(EthSepoliaService::PublicNode), base_fee_json.to_string(), max_response_size_bytes),
        cycles,
    )
    .await
    .map_err(|e| format!("Failed to get base fee: {:?}", e))?;

    let base_fee_per_gas = match base_fee_response {
        super::evm_rpc_canister::RequestResult::Ok(result) => {
            let response: serde_json::Value = serde_json::from_str(&result)
                .map_err(|e| format!("Failed to parse base fee response: {}", e))?;
            
            let base_fee = response
                .get("result")
                .and_then(|v| v.get("baseFeePerGas"))
                .and_then(|v| v.as_str())
                .ok_or("No base fee in response")?;

            let base_fee_hex = base_fee.trim_start_matches("0x");
            u128::from_str_radix(base_fee_hex, 16)
                .map_err(|e| format!("Failed to parse hex base fee: {}", e))?
        }
        super::evm_rpc_canister::RequestResult::Err(_) => {
            // Fallback to gas price if base fee not available
            gas_price
        }
    };

    // Estimate gas limit if not provided
    let estimated_gas_limit = gas_limit.unwrap_or(21_000); // Standard ETH transfer

    // Calculate priority fees (tip) - different speeds
    let slow_priority_fee = 1_000_000_000u128; // 1 gwei
    let medium_priority_fee = 2_000_000_000u128; // 2 gwei  
    let fast_priority_fee = 5_000_000_000u128; // 5 gwei

    // Calculate max fee per gas for different speeds
    let slow_max_fee = base_fee_per_gas + slow_priority_fee;
    let medium_max_fee = base_fee_per_gas + medium_priority_fee;
    let fast_max_fee = base_fee_per_gas + fast_priority_fee;

    // Use medium speed as default
    let max_priority_fee_per_gas = medium_priority_fee;
    let max_fee_per_gas = medium_max_fee;

    // Calculate total fee
    let total_fee_wei = estimated_gas_limit * max_fee_per_gas;
    let total_fee_eth = total_fee_wei as f64 / 1_000_000_000_000_000_000.0; // Convert wei to ETH

    // Determine transaction speed
    let transaction_speed = if max_priority_fee_per_gas <= slow_priority_fee {
        "slow".to_string()
    } else if max_priority_fee_per_gas <= medium_priority_fee {
        "medium".to_string()
    } else {
        "fast".to_string()
    };

    Ok(EthFeePreview {
        estimated_gas_limit,
        base_fee_per_gas,
        max_priority_fee_per_gas,
        max_fee_per_gas,
        total_fee_wei,
        total_fee_eth,
        gas_price,
        transaction_speed,
    })
}

// Get native ETH balance
pub async fn get_native_eth_balance(address: Option<String>) -> Result<Nat, String> {
    let address = address.ok_or("Address is required for native ETH balance")?;

    let json = format!(
        r#"{{ "jsonrpc": "2.0", "method": "eth_getBalance", "params": ["{}", "latest"], "id": 1 }}"#,
        address
    );

    let max_response_size_bytes = 500_u64;
    let cycles = 5_000_000_000u128; // Increased to 5 billion cycles
    let rpc_service = RpcService::EthSepolia(EthSepoliaService::PublicNode);

    let (response,) = call_with_payment128(
        get_evm_rpc_canister_id(),
        "request",
        (rpc_service, json, max_response_size_bytes),
        cycles,
    )
    .await
    .map_err(|e| format!("RPC call failed: {:?}", e))?;

    match response {
        super::evm_rpc_canister::RequestResult::Ok(balance_result) => {
            let response: serde_json::Value = serde_json::from_str(&balance_result)
                .map_err(|e| format!("Failed to parse response: {}", e))?;
            
            let hex_balance = response
                .get("result")
                .and_then(|v| v.as_str())
                .ok_or("No result in response")?;

            // Remove "0x" prefix and convert to decimal
            let balance = hex_balance.trim_start_matches("0x");
            let big_uint = num::BigUint::parse_bytes(balance.as_bytes(), 16)
                .ok_or("Failed to parse hex balance")?;
            
            Ok(Nat(big_uint))
        }
        super::evm_rpc_canister::RequestResult::Err(_e) => {
            Err("RPC error occurred".to_string())
        }
    }
}

// Get transaction count (nonce)
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

// Helper functions
fn estimate_transaction_fees() -> (u128, u128, u128) {
    const GAS_LIMIT: u128 = 21_000; // Standard ETH transfer
    const MAX_FEE_PER_GAS: u128 = 50_000_000_000; // 50 gwei
    const MAX_PRIORITY_FEE_PER_GAS: u128 = 1_500_000_000; // 1.5 gwei
    (GAS_LIMIT, MAX_FEE_PER_GAS, MAX_PRIORITY_FEE_PER_GAS)
}

fn nat_to_u64(nat: Nat) -> u64 {
    use num_traits::cast::ToPrimitive;
    nat.0
        .to_u64()
        .unwrap_or_else(|| ic_cdk::trap(&format!("Nat {} doesn't fit into a u64", nat)))
}

fn nat_to_u256(value: Nat) -> U256 {
    let value_bytes = value.0.to_bytes_be();
    assert!(
        value_bytes.len() <= 32,
        "Nat does not fit in a U256: {}",
        value
    );
    let mut value_u256 = [0u8; 32];
    value_u256[32 - value_bytes.len()..].copy_from_slice(&value_bytes);
    U256::from_be_bytes(value_u256)
}

// Init function
#[init]
pub fn init(maybe_init: Option<InitArg>) {
    if let Some(_init_arg) = maybe_init {
        // Initialize state if needed
        ic_cdk::println!("Ethereum transfer service initialized");
    }
}

#[derive(CandidType, Deserialize, Debug, Default, PartialEq, Eq)]
pub struct InitArg {
    pub ethereum_network: Option<EthereumNetwork>,
}


