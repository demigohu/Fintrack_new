use candid::CandidType;
use ic_cdk::api::management_canister::http_request::{
    CanisterHttpRequestArgument, HttpHeader, HttpMethod, TransformArgs, TransformContext, HttpResponse, http_request as mgmt_http_request,
};
use serde::Deserialize;

#[derive(CandidType, Deserialize)]
pub struct CryptoRates {
    pub btc_to_usd: f64,
    pub eth_to_usd: f64,
    pub sol_to_usd: f64,
    pub last_updated: u64,
}

#[ic_cdk::query]
pub fn transform(args: TransformArgs) -> HttpResponse {
    // Drop headers for determinism; passthrough body & status
    HttpResponse { status: args.response.status, body: args.response.body, headers: vec![] }
}

pub async fn get_crypto_usd_rate(crypto_id: &str) -> Result<f64, String> {
    // Use Coingecko 'ids' parameter with canonical ids (bitcoin, ethereum, solana)
    let id = match crypto_id {
        "btc" | "bitcoin" => "bitcoin",
        "eth" | "ethereum" => "ethereum",
        "sol" | "solana" => "solana",
        other => other,
    };

    let url = format!(
        "https://api.coingecko.com/api/v3/simple/price?ids={}&vs_currencies=usd",
        id
    );

    let headers = vec![
        HttpHeader { name: "Accept".into(), value: "application/json".into() },
        HttpHeader { name: "X-Cg-Demo-Api-Key".into(), value: "CG-R6KYDr2MxXQ3Y34TNTWyhuhn".into() },
    ];

    let request = CanisterHttpRequestArgument {
        url,
        method: HttpMethod::GET,
        body: None,
        max_response_bytes: Some(2000),
        transform: Some(TransformContext::from_name("transform".to_string(), vec![])),
        headers,
    };

    match mgmt_http_request(request, 100_000_000).await {
        Ok((response,)) => {
            let str_body = String::from_utf8(response.body)
                .map_err(|_| "Failed to decode response body".to_string())?;
            let json: serde_json::Value = serde_json::from_str(&str_body)
                .map_err(|_| "Failed to parse JSON".to_string())?;
            let rate = json
                .get(id)
                .and_then(|v| v.get("usd"))
                .and_then(|v| v.as_f64())
                .ok_or_else(|| format!("No usd rate for {}", id))?;
            Ok(rate)
        }
        Err((code, msg)) => Err(format!("HTTP request failed. Code: {:?}, Msg: {}", code, msg)),
    }
}

pub async fn get_rates_summary() -> Result<CryptoRates, String> {
    // Fetch all three in a single request to reduce latency
    let url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd".to_string();
    let headers = vec![
        HttpHeader { name: "Accept".into(), value: "application/json".into() },
        HttpHeader { name: "X-Cg-Demo-Api-Key".into(), value: "CG-R6KYDr2MxXQ3Y34TNTWyhuhn".into() },
    ];
    let request = CanisterHttpRequestArgument {
        url,
        method: HttpMethod::GET,
        body: None,
        max_response_bytes: Some(4000),
        transform: Some(TransformContext::from_name("transform".to_string(), vec![])),
        headers,
    };
    let (btc, eth, sol) = match mgmt_http_request(request, 100_000_000).await {
        Ok((response,)) => {
            let str_body = String::from_utf8(response.body).map_err(|_| "Failed to decode response body".to_string())?;
            let json: serde_json::Value = serde_json::from_str(&str_body).map_err(|_| "Failed to parse JSON".to_string())?;
            let btc = json.get("bitcoin").and_then(|v| v.get("usd")).and_then(|v| v.as_f64()).unwrap_or(0.0);
            let eth = json.get("ethereum").and_then(|v| v.get("usd")).and_then(|v| v.as_f64()).unwrap_or(0.0);
            let sol = json.get("solana").and_then(|v| v.get("usd")).and_then(|v| v.as_f64()).unwrap_or(0.0);
            (btc, eth, sol)
        }
        Err(_) => (0.0, 0.0, 0.0),
    };

    Ok(CryptoRates {
        btc_to_usd: btc,
        eth_to_usd: eth,
        sol_to_usd: sol,
        last_updated: ic_cdk::api::time(),
    })
}


