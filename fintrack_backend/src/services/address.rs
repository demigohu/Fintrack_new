use candid::Principal;
use ic_cdk::api::management_canister::ecdsa::{ecdsa_public_key, EcdsaKeyId, EcdsaPublicKeyArgument};
use bitcoin::{Address, Network};
use sha3::{Digest, Keccak256};
use k256::PublicKey as K256PublicKey;
use k256::elliptic_curve::sec1::ToEncodedPoint;

const DEFAULT_ECDSA_KEY_NAME: &str = "key_1"; // Use "dfx_test_key" for testnet
const BTC_NETWORK: Network = Network::Testnet; // Testnet Bitcoin

fn principal_derivation_path(owner: Principal) -> Vec<Vec<u8>> {
    vec![owner.as_slice().to_vec()]
}

async fn fetch_ecdsa_pubkey(owner: Principal) -> Result<Vec<u8>, String> {
    let args = EcdsaPublicKeyArgument {
        canister_id: None,
        derivation_path: principal_derivation_path(owner),
        key_id: EcdsaKeyId {
            curve: ic_cdk::api::management_canister::ecdsa::EcdsaCurve::Secp256k1,
            name: DEFAULT_ECDSA_KEY_NAME.to_string(),
        },
    };
    let (res,) = ecdsa_public_key(args)
        .await
        .map_err(|e| format!("ecdsa_public_key failed: {}", e.1))?;
    Ok(res.public_key)
}

fn ethereum_address_from_pubkey_sec1(pubkey_sec1: &[u8]) -> String {
    // Parse SEC1 bytes (compressed or uncompressed) and re-encode uncompressed
    let key = K256PublicKey::from_sec1_bytes(pubkey_sec1).expect("invalid secp256k1 public key");
    let point = key.to_encoded_point(false);
    let point_bytes = point.as_bytes();
    debug_assert_eq!(point_bytes[0], 0x04);
    // keccak256 of 64 bytes (x||y)
    let mut hasher = Keccak256::new();
    hasher.update(&point_bytes[1..]);
    let hash = hasher.finalize();
    let addr_bytes = &hash[12..32];
    format!("0x{}", hex::encode(addr_bytes))
}

pub async fn get_eth_address(owner: Option<Principal>) -> Result<String, String> {
    let owner = owner.unwrap_or_else(ic_cdk::api::caller);
    let pubkey = fetch_ecdsa_pubkey(owner).await?;
    Ok(ethereum_address_from_pubkey_sec1(&pubkey))
}

pub async fn get_btc_address(owner: Option<Principal>) -> Result<String, String> {
    let owner = owner.unwrap_or_else(ic_cdk::api::caller);
    let pubkey = fetch_ecdsa_pubkey(owner).await?;
    // Use compressed key for P2WPKH
    let compressed = bitcoin::key::CompressedPublicKey::from_slice(&pubkey)
        .map_err(|e| format!("invalid compressed pubkey: {e}"))?;
    
    // Address::p2wpkh returns Address directly, not Result
    let addr = Address::p2wpkh(&compressed, BTC_NETWORK);
    Ok(addr.to_string())
}


