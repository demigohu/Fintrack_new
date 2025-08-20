use candid::Principal;
use ic_cdk::{
    bitcoin_canister::{
        bitcoin_get_utxos, bitcoin_send_transaction, GetUtxosRequest, SendTransactionRequest,
        MillisatoshiPerByte, Satoshi, Utxo, Network as IcNetwork,
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

const DEFAULT_ECDSA_KEY_NAME: &str = "dfx_test_key"; // Use "test_key_1" or "key_1" on IC
const BTC_NETWORK: BtcNetwork = BtcNetwork::Regtest; // Bitcoin network

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

// Convert Bitcoin network to IC network
fn btc_network_to_ic_network(network: BtcNetwork) -> IcNetwork {
    match network {
        BtcNetwork::Bitcoin => IcNetwork::Mainnet,
        BtcNetwork::Testnet => IcNetwork::Testnet,
        BtcNetwork::Signet => IcNetwork::Testnet, // Fallback to testnet
        BtcNetwork::Regtest => IcNetwork::Regtest,
        _ => IcNetwork::Regtest, // Default fallback
    }
}

// Get UTXOs untuk address tertentu
pub async fn get_utxos_for_address(address: String) -> Result<Vec<Utxo>, String> {
    let response = bitcoin_get_utxos(&GetUtxosRequest {
        address,
        network: btc_network_to_ic_network(BTC_NETWORK),
        filter: None,
    })
    .await
    .map_err(|e| format!("Failed to get UTXOs: {:?}", e))?;

    Ok(response.utxos)
}

// Get current fee percentiles
pub async fn get_current_fee_percentiles() -> Result<Vec<MillisatoshiPerByte>, String> {
    ic_cdk::bitcoin_canister::bitcoin_get_current_fee_percentiles(
        &ic_cdk::bitcoin_canister::GetCurrentFeePercentilesRequest {
            network: btc_network_to_ic_network(BTC_NETWORK),
        },
    )
    .await
    .map_err(|e| format!("Failed to get fee percentiles: {:?}", e))
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
    let send_result = bitcoin_send_transaction(&SendTransactionRequest {
        network: btc_network_to_ic_network(BTC_NETWORK),
        transaction: tx_bytes,
    })
    .await;
    
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
