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

#[derive(CandidType, Deserialize)]
pub struct MarketChartData {
    pub prices: Vec<Vec<f64>>,
    pub market_caps: Vec<Vec<f64>>,
    pub total_volumes: Vec<Vec<f64>>,
}

#[derive(CandidType, Deserialize)]
pub struct PriceData {
    pub timestamp: u64,
    pub price: f64,
}

#[derive(CandidType, Deserialize)]
pub struct MarketCapData {
    pub timestamp: u64,
    pub market_cap: f64,
}

#[derive(CandidType, Deserialize)]
pub struct VolumeData {
    pub timestamp: u64,
    pub volume: f64,
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

pub async fn get_market_chart(
    coin_id: &str, 
    vs_currency: &str, 
    days: u32
) -> Result<MarketChartData, String> {
    // Map coin symbols to CoinGecko IDs
    let id = match coin_id {
        "btc" | "bitcoin" => "bitcoin",
        "eth" | "ethereum" => "ethereum",
        "sol" | "solana" => "solana",
        "usdc" => "usd-coin",
        "weth" => "weth",
        other => other,
    };

    let url = format!(
        "https://api.coingecko.com/api/v3/coins/{}/market_chart?vs_currency={}&days={}&interval=daily",
        id, vs_currency, days
    );

    let headers = vec![
        HttpHeader { name: "Accept".into(), value: "application/json".into() },
        HttpHeader { name: "X-Cg-Demo-Api-Key".into(), value: "CG-R6KYDr2MxXQ3Y34TNTWyhuhn".into() },
    ];

    let request = CanisterHttpRequestArgument {
        url,
        method: HttpMethod::GET,
        body: None,
        max_response_bytes: Some(50000), // Larger response for historical data
        transform: Some(TransformContext::from_name("transform".to_string(), vec![])),
        headers,
    };

    match mgmt_http_request(request, 600_000_000).await {
        Ok((response,)) => {
            let str_body = String::from_utf8(response.body)
                .map_err(|_| "Failed to decode response body".to_string())?;
            
            let json: serde_json::Value = serde_json::from_str(&str_body)
                .map_err(|_| "Failed to parse JSON".to_string())?;

            let prices = json
                .get("prices")
                .and_then(|v| v.as_array())
                .ok_or("Missing prices data")?
                .iter()
                .filter_map(|item| {
                    if let Some(arr) = item.as_array() {
                        if arr.len() >= 2 {
                            Some(vec![
                                arr[0].as_f64().unwrap_or(0.0),
                                arr[1].as_f64().unwrap_or(0.0)
                            ])
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                })
                .collect();

            let market_caps = json
                .get("market_caps")
                .and_then(|v| v.as_array())
                .ok_or("Missing market_caps data")?
                .iter()
                .filter_map(|item| {
                    if let Some(arr) = item.as_array() {
                        if arr.len() >= 2 {
                            Some(vec![
                                arr[0].as_f64().unwrap_or(0.0),
                                arr[1].as_f64().unwrap_or(0.0)
                            ])
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                })
                .collect();

            let total_volumes = json
                .get("total_volumes")
                .and_then(|v| v.as_array())
                .ok_or("Missing total_volumes data")?
                .iter()
                .filter_map(|item| {
                    if let Some(arr) = item.as_array() {
                        if arr.len() >= 2 {
                            Some(vec![
                                arr[0].as_f64().unwrap_or(0.0),
                                arr[1].as_f64().unwrap_or(0.0)
                            ])
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                })
                .collect();

            Ok(MarketChartData {
                prices,
                market_caps,
                total_volumes,
            })
        }
        Err((code, msg)) => Err(format!("HTTP request failed. Code: {:?}, Msg: {}", code, msg)),
    }
}

pub async fn get_24h_change(coin_id: &str) -> Result<f64, String> {
    // Get 1 day of data to calculate 24h change
    let chart_data = get_market_chart(coin_id, "usd", 1).await?;
    
    if chart_data.prices.len() < 2 {
        return Err("Insufficient price data for 24h change calculation".to_string());
    }

    let current_price = chart_data.prices.last().unwrap()[1];
    let price_24h_ago = chart_data.prices.first().unwrap()[1];
    
    if price_24h_ago == 0.0 {
        return Err("Cannot calculate 24h change: price 24h ago is zero".to_string());
    }

    let change_percent = ((current_price - price_24h_ago) / price_24h_ago) * 100.0;
    Ok(change_percent)
}

pub async fn get_historical_prices(
    coin_id: &str, 
    vs_currency: &str, 
    days: u32
) -> Result<Vec<PriceData>, String> {
    let chart_data = get_market_chart(coin_id, vs_currency, days).await?;
    
    let prices: Vec<PriceData> = chart_data.prices
        .iter()
        .map(|price_point| PriceData {
            timestamp: price_point[0] as u64,
            price: price_point[1],
        })
        .collect();
    
    Ok(prices)
}


