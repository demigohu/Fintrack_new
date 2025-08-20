use candid::Principal;
use std::str::FromStr;

/// Convert ICP principal to bytes32 format using official method
pub fn principal_to_bytes32(principal_text: String) -> Result<String, String> {
    // Parse principal from text
    let principal = Principal::from_str(&principal_text)
        .map_err(|e| format!("Failed to parse principal: {}", e))?;
    
    // Get principal as bytes
    let principal_bytes = principal.as_slice();
    
    // Check length constraint (max 29 bytes)
    if principal_bytes.len() > 29 {
        return Err(format!("Principal too long: {} bytes (max 29)", principal_bytes.len()));
    }
    
    // Create fixed 32-byte array
    let mut fixed_bytes = [0u8; 32];
    
    // Set length in first byte
    fixed_bytes[0] = principal_bytes.len() as u8;
    
    // Copy principal bytes starting from second byte
    fixed_bytes[1..=principal_bytes.len()].copy_from_slice(principal_bytes);
    
    // Convert to hex string
    let hex_string = hex::encode(fixed_bytes);
    
    Ok(format!("0x{}", hex_string))
}
