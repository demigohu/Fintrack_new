use candid::Principal;
use ic_cdk::api::call::call_with_payment128;
use ic_cdk::{
    bitcoin_canister::{
        bitcoin_get_utxos, bitcoin_send_transaction, bitcoin_get_current_fee_percentiles, bitcoin_get_balance,
        GetUtxosRequest, SendTransactionRequest, GetCurrentFeePercentilesRequest, GetBalanceRequest,
        MillisatoshiPerByte, Satoshi, Utxo,
    },
};
use bitcoin::{
    consensus::serialize,
    ecdsa::Signature as BitcoinSignature,
    secp256k1::{ecdsa::Signature as SecpSignature, Message},
    sighash::{EcdsaSighashType, SighashCache},
    Address, AddressType, PublicKey, ScriptBuf, Transaction, TxOut, Witness, Network as BtcNetwork,
    transaction::Version, Amount, Txid,
    absolute::LockTime,
    hashes::Hash,
};
use std::str::FromStr;

const DEFAULT_ECDSA_KEY_NAME: &str = "key_1"; // Use "dfx_test_key" for testnet
const BTC_NETWORK: BtcNetwork = BtcNetwork::Testnet; // Bitcoin testnet
const IC_BTC_NETWORK: ic_cdk::bitcoin_canister::Network = ic_cdk::bitcoin_canister::Network::Testnet; // IC Bitcoin canister testnet

// Request struct untuk transfer BTC
#[derive(candid::CandidType, candid::Deserialize)]
pub struct BtcTransferRequest {
    pub destination_address: String,
    pub amount_in_satoshi: u64,
    pub owner: Option<Principal>, // Jika None, gunakan caller
}

// Response struct untuk transfer BTC
#[derive(candid::CandidType, candid::Deserialize)]
pub struct BtcTransferResponse {
    pub success: bool,
    pub transaction_id: Option<String>,
    pub error: Option<String>,
}

// Fee preview struct untuk BTC transfer
#[derive(candid::CandidType, candid::Deserialize)]
pub struct BtcFeePreview {
    pub estimated_fee_sats: u64,
    pub fee_rate_sats_per_vb: u64,
    pub estimated_tx_size_vb: u64,
    pub confirmation_time_estimate: String, // "fast", "medium", "slow"
    pub total_amount_with_fee: u64,
    pub change_amount: u64,
}


// Get UTXOs untuk address tertentu
pub async fn get_utxos_for_address(address: String) -> Result<Vec<Utxo>, String> {
    // Lampirkan cycles yang cukup (mainnet get_utxos: min 10_000_000_000)
    let cycles: u128 = 10_000_000_000;
    
    let (response,): (ic_cdk::bitcoin_canister::GetUtxosResponse,) = call_with_payment128(
        Principal::management_canister(),
        "bitcoin_get_utxos",
        (GetUtxosRequest {
            address,
            network: IC_BTC_NETWORK,
            filter: None,
        },),
        cycles,
    )
    .await
    .map_err(|e| format!("bitcoin_get_utxos failed: {:?}", e))?;

    Ok(response.utxos)
}

// Get current fee percentiles
pub async fn get_current_fee_percentiles() -> Result<Vec<MillisatoshiPerByte>, String> {
    // Lampirkan cycles yang cukup (mainnet get_current_fee_percentiles: min 100_000_000)
    let cycles: u128 = 100_000_000;
    
    let (fee_percentiles,): (Vec<MillisatoshiPerByte>,) = call_with_payment128(
        Principal::management_canister(),
        "bitcoin_get_current_fee_percentiles",
        (GetCurrentFeePercentilesRequest {
            network: IC_BTC_NETWORK,
        },),
        cycles,
    )
    .await
    .map_err(|e| format!("bitcoin_get_current_fee_percentiles failed: {:?}", e))?;
    
    Ok(fee_percentiles)
}

// Get native BTC balance for an address
pub async fn get_native_btc_balance(address: String) -> Result<u64, String> {
    // Lampirkan cycles yang cukup (mainnet get_balance: min 100_000_000)
    let cycles: u128 = 100_000_000;
    
    let (balance,): (u64,) = call_with_payment128(
        Principal::management_canister(),
        "bitcoin_get_balance",
        (GetBalanceRequest {
            address,
            network: IC_BTC_NETWORK,
            min_confirmations: Some(0), // Include unconfirmed transactions
        },),
        cycles,
    )
    .await
    .map_err(|e| format!("bitcoin_get_balance failed: {:?}", e))?;

    Ok(balance)
}

// Get ECDSA public key untuk principal
async fn get_ecdsa_public_key(owner: Principal) -> Result<Vec<u8>, String> {
    let derivation_path = vec![owner.as_slice().to_vec()];
    
    let args = ic_cdk::api::management_canister::ecdsa::EcdsaPublicKeyArgument {
        canister_id: None,
        derivation_path,
        key_id: ic_cdk::api::management_canister::ecdsa::EcdsaKeyId {
            curve: ic_cdk::api::management_canister::ecdsa::EcdsaCurve::Secp256k1,
            name: DEFAULT_ECDSA_KEY_NAME.to_string(),
        },
    };
    
    let (res,) = ic_cdk::api::management_canister::ecdsa::ecdsa_public_key(args)
        .await
        .map_err(|e| format!("ecdsa_public_key failed: {}", e.1))?;
    
    Ok(res.public_key)
}

// Sign dengan ECDSA
async fn sign_with_ecdsa(
    key_name: String,
    derivation_path: Vec<Vec<u8>>,
    message_hash: Vec<u8>,
) -> SecpSignature {
    let (signature_response,) = ic_cdk::api::management_canister::ecdsa::sign_with_ecdsa(
        ic_cdk::api::management_canister::ecdsa::SignWithEcdsaArgument {
            message_hash,
            derivation_path,
            key_id: ic_cdk::api::management_canister::ecdsa::EcdsaKeyId {
                curve: ic_cdk::api::management_canister::ecdsa::EcdsaCurve::Secp256k1,
                name: key_name,
            },
        },
    )
    .await
    .unwrap();

    SecpSignature::from_compact(&signature_response.signature).unwrap()
}

// Build transaction dengan fee estimation
async fn build_transaction_with_fee(
    _own_public_key: &PublicKey,
    own_address: &Address,
    own_utxos: &[Utxo],
    dst_address: &Address,
    amount: Satoshi,
    fee_per_vbyte: MillisatoshiPerByte,
) -> Result<(Transaction, Vec<TxOut>), String> {
    // Simple fee estimation: start with 0, then iterate
    let mut fee = 0u64;
    let max_iterations = 5;
    let mut iteration = 0;
    
    loop {
        if iteration >= max_iterations {
            return Err("Failed to estimate fee after maximum iterations".to_string());
        }
        iteration += 1;
        
        // Select UTXOs to spend
        let utxos_to_spend = select_utxos_greedy(own_utxos, amount, fee)?;
        if utxos_to_spend.is_empty() {
            return Err("Insufficient funds".to_string());
        }
        
        // Build transaction
        let (transaction, prevouts) = build_transaction_simple(
            &utxos_to_spend,
            own_address,
            dst_address,
            amount,
            fee,
        )?;
        
        // Estimate transaction size (simplified)
        let estimated_size = estimate_transaction_size(&transaction);
        let calculated_fee = (estimated_size as u64 * fee_per_vbyte) / 1000;
        
        if calculated_fee == fee {
            return Ok((transaction, prevouts));
        }
        
        fee = calculated_fee;
    }
}

// Simple UTXO selection (greedy algorithm)
fn select_utxos_greedy(
    utxos: &[Utxo],
    amount: Satoshi,
    fee: u64,
) -> Result<Vec<Utxo>, String> {
    let mut selected_utxos = Vec::new();
    let mut total_value = 0u64;
    
    for utxo in utxos {
        selected_utxos.push(utxo.clone());
        total_value += utxo.value;
        
        if total_value >= amount + fee {
            return Ok(selected_utxos);
        }
    }
    
    Err("Insufficient funds".to_string())
}

// Build simple transaction
fn build_transaction_simple(
    utxos: &[Utxo],
    own_address: &Address,
    dst_address: &Address,
    amount: Satoshi,
    fee: u64,
) -> Result<(Transaction, Vec<TxOut>), String> {
    let mut transaction = Transaction {
        version: Version(2),
        lock_time: LockTime::ZERO,
        input: Vec::new(),
        output: Vec::new(),
    };
    
    let mut prevouts = Vec::new();
    
    // Add inputs
    for utxo in utxos {
        let outpoint = bitcoin::OutPoint {
            txid: Txid::from_raw_hash(
                bitcoin::hashes::sha256d::Hash::from_slice(&utxo.outpoint.txid)
                    .map_err(|e| format!("Invalid txid: {}", e))?
            ),
            vout: utxo.outpoint.vout,
        };
        
        transaction.input.push(bitcoin::TxIn {
            previous_output: outpoint,
            script_sig: ScriptBuf::new(),
            sequence: bitcoin::Sequence::MAX,
            witness: Witness::new(),
        });
        
        // Create TxOut for prevout - use P2WPKH script for P2WPKH address
        let script_pubkey = own_address.script_pubkey();
        
        prevouts.push(TxOut {
            value: Amount::from_sat(utxo.value),
            script_pubkey,
        });
    }
    
    // Add outputs
    let total_input: u64 = utxos.iter().map(|u| u.value).sum();
    let change_amount = total_input - amount - fee;
    
    // Destination output
    transaction.output.push(TxOut {
        value: Amount::from_sat(amount),
        script_pubkey: dst_address.script_pubkey(),
    });
    
    // Change output (if any)
    if change_amount > 0 {
        transaction.output.push(TxOut {
            value: Amount::from_sat(change_amount),
            script_pubkey: own_address.script_pubkey(),
        });
    }
    
    Ok((transaction, prevouts))
}

// Estimate transaction size (simplified)
fn estimate_transaction_size(transaction: &Transaction) -> usize {
    // Rough estimation: 4 bytes version + 4 bytes locktime + inputs + outputs
    let base_size = 8;
    let input_size = transaction.input.len() * 150; // Approximate input size
    let output_size = transaction.output.len() * 34; // Approximate output size
    
    base_size + input_size + output_size
}

// Sign transaction
async fn sign_transaction(
    own_public_key: &PublicKey,
    own_address: &Address,
    mut transaction: Transaction,
    prevouts: &[TxOut],
    derivation_path: Vec<Vec<u8>>,
) -> Result<Transaction, String> {
    // Verify address type
    if own_address.address_type() != Some(AddressType::P2wpkh) {
        return Err("Only P2WPKH addresses are supported".to_string());
    }
    
    let transaction_clone = transaction.clone();
    let mut sighash_cache = SighashCache::new(&transaction_clone);
    
    for (index, input) in transaction.input.iter_mut().enumerate() {
        let script_pubkey = &prevouts[index].script_pubkey;
        let value = prevouts[index].value;
        
        let sighash = sighash_cache
            .p2wpkh_signature_hash(index, script_pubkey, value, EcdsaSighashType::All)
            .map_err(|e| format!("Failed to create sighash: {}", e))?;
        
        let message = Message::from(sighash);
        
        let raw_signature = sign_with_ecdsa(
            DEFAULT_ECDSA_KEY_NAME.to_string(),
            derivation_path.clone(),
            message.as_ref().to_vec(),
        )
        .await;
        
        let signature = BitcoinSignature {
            signature: raw_signature,
            sighash_type: EcdsaSighashType::All,
        };
        
        input.script_sig = ScriptBuf::new();
        input.witness = Witness::new();
        input.witness.push(signature.to_vec());
        input.witness.push(own_public_key.to_bytes());
    }
    
    Ok(transaction)
}

// Preview fee for BTC transfer
pub async fn preview_btc_fee(
    destination_address: String,
    amount_in_satoshi: u64,
    owner: Option<Principal>,
) -> Result<BtcFeePreview, String> {
    let owner = owner.unwrap_or_else(ic_cdk::api::caller);
    
    // Parse destination address
    let _dst_address = Address::from_str(&destination_address)
        .map_err(|e| format!("Invalid destination address: {}", e))?
        .require_network(BTC_NETWORK)
        .map_err(|e| format!("Address not valid for network: {}", e))?;
    
    // Get ECDSA public key
    let public_key_bytes = get_ecdsa_public_key(owner).await?;
    let own_public_key = PublicKey::from_slice(&public_key_bytes)
        .map_err(|e| format!("Invalid public key: {}", e))?;
    
    // Generate own address
    let own_address = Address::p2wpkh(
        &bitcoin::key::CompressedPublicKey::from_slice(&public_key_bytes)
            .map_err(|e| format!("Invalid compressed public key: {}", e))?,
        BTC_NETWORK,
    );
    
    // Get UTXOs
    let own_utxos = get_utxos_for_address(own_address.to_string()).await?;
    if own_utxos.is_empty() {
        return Err("No UTXOs found for address".to_string());
    }
    
    // Get current fee percentiles
    let fee_percentiles = get_current_fee_percentiles().await?;
    
    // Calculate fee rates for different speeds
    let slow_fee_rate = fee_percentiles.get(25).copied().unwrap_or(1000); // 25th percentile
    let medium_fee_rate = fee_percentiles.get(50).copied().unwrap_or(1500); // 50th percentile (median)
    let fast_fee_rate = fee_percentiles.get(75).copied().unwrap_or(2500); // 75th percentile
    
    // Use medium fee rate as default
    let fee_rate_sats_per_vb = medium_fee_rate;
    
    // Estimate transaction size
    // Standard P2WPKH input: ~68 bytes, output: ~31 bytes
    let input_count = own_utxos.len().min(10); // Limit to reasonable number
    let output_count = 2; // destination + change
    
    let estimated_tx_size_vb = (input_count * 68 + output_count * 31 + 10) as u64; // +10 for overhead
    
    // Calculate estimated fee
    let estimated_fee_sats = (estimated_tx_size_vb * fee_rate_sats_per_vb) / 1000; // Convert from millisats
    
    // Calculate total amount needed
    let total_amount_with_fee = amount_in_satoshi + estimated_fee_sats;
    
    // Calculate change (simplified - in reality would need proper UTXO selection)
    let total_input_value: u64 = own_utxos.iter().take(input_count).map(|utxo| utxo.value).sum();
    let change_amount = if total_input_value > total_amount_with_fee {
        total_input_value - total_amount_with_fee
    } else {
        0
    };
    
    // Determine confirmation time estimate based on fee rate
    let confirmation_time_estimate = if fee_rate_sats_per_vb >= fast_fee_rate {
        "fast".to_string()
    } else if fee_rate_sats_per_vb >= medium_fee_rate {
        "medium".to_string()
    } else {
        "slow".to_string()
    };
    
    Ok(BtcFeePreview {
        estimated_fee_sats,
        fee_rate_sats_per_vb,
        estimated_tx_size_vb,
        confirmation_time_estimate,
        total_amount_with_fee,
        change_amount,
    })
}

// Main transfer function
pub async fn transfer_btc(request: BtcTransferRequest) -> Result<BtcTransferResponse, String> {
    let owner = request.owner.unwrap_or_else(ic_cdk::api::caller);
    
    if request.amount_in_satoshi == 0 {
        return Ok(BtcTransferResponse {
            success: false,
            transaction_id: None,
            error: Some("Amount must be greater than 0".to_string()),
        });
    }
    
    // Parse destination address
    let dst_address = Address::from_str(&request.destination_address)
        .map_err(|e| format!("Invalid destination address: {}", e))?
        .require_network(BTC_NETWORK)
        .map_err(|e| format!("Address not valid for network: {}", e))?;
    
    // Get ECDSA public key
    let public_key_bytes = get_ecdsa_public_key(owner).await?;
    let own_public_key = PublicKey::from_slice(&public_key_bytes)
        .map_err(|e| format!("Invalid public key: {}", e))?;
    
    // Generate own address
    let own_address = Address::p2wpkh(
        &bitcoin::key::CompressedPublicKey::from_slice(&public_key_bytes)
            .map_err(|e| format!("Invalid compressed public key: {}", e))?,
        BTC_NETWORK,
    );
    
    // Get UTXOs
    let own_utxos = get_utxos_for_address(own_address.to_string()).await?;
    if own_utxos.is_empty() {
        return Ok(BtcTransferResponse {
            success: false,
            transaction_id: None,
            error: Some("No UTXOs found for address".to_string()),
        });
    }
    
    // Get fee rate
    let fee_percentiles = get_current_fee_percentiles().await?;
    let fee_per_vbyte = fee_percentiles
        .get(50) // Use median fee
        .copied()
        .unwrap_or(1000); // Default fee if not available
    
    // Build transaction
    let (transaction, prevouts) = build_transaction_with_fee(
        &own_public_key,
        &own_address,
        &own_utxos,
        &dst_address,
        request.amount_in_satoshi,
        fee_per_vbyte,
    )
    .await?;
    
    // Sign transaction
    let derivation_path = vec![owner.as_slice().to_vec()];
    let signed_transaction = sign_transaction(
        &own_public_key,
        &own_address,
        transaction,
        &prevouts,
        derivation_path,
    )
    .await?;
    
    // Send transaction
    let tx_bytes = serialize(&signed_transaction);
    // Lampirkan cycles yang cukup (mainnet send_transaction: 5B + 20M per byte)
    let cycles: u128 = 5_000_000_000 + (tx_bytes.len() as u128 * 20_000_000);
    
    let send_result: Result<(), String> = call_with_payment128(
        Principal::management_canister(),
        "bitcoin_send_transaction",
        (SendTransactionRequest {
            network: IC_BTC_NETWORK,
            transaction: tx_bytes,
        },),
        cycles,
    )
    .await
    .map_err(|e| format!("bitcoin_send_transaction failed: {:?}", e));
    
    match send_result {
        Ok(_) => {
            let txid = signed_transaction.compute_txid().to_string();
            Ok(BtcTransferResponse {
                success: true,
                transaction_id: Some(txid),
                error: None,
            })
        }
        Err(e) => Ok(BtcTransferResponse {
            success: false,
            transaction_id: None,
            error: Some(format!("Failed to send transaction: {:?}", e)),
        }),
    }
}
