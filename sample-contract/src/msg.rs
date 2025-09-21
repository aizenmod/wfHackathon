use cosmwasm_schema::QueryResponses;
use cosmwasm_std::{Addr, Binary};
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct OracleDataResponse {
    pub data: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct OraclePubkeyResponse {
    pub pubkey: Binary,
    pub key_type: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct AdminResponse {
    pub admin: Addr,
}
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    pub oracle_pubkey: Binary,
    pub oracle_key_type: String, // "secp256k1" or "ed25519"
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    Send { recipient: String },
    OracleDataUpdate { data: String, signature: Binary },
    UpdateOracle { new_pubkey: Binary, new_key_type: Option<String> },
    /// Perform a send only if an oracle-signed AML assessment passes
    /// The oracle signs sha256("{wallet}|{chain}|{risk}|{expires}") with its pubkey
    /// Contract checks: signature validity, not expired, risk <= max_risk
    SendWithAmlCheck {
        recipient: String,
        wallet: String,
        chain: String,
        max_risk: u8,
        risk: u8,
        expires: u64,
        signature: Binary,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
#[derive(QueryResponses)]
pub enum QueryMsg {
    /// Returns: OracleDataResponse
    #[returns(OracleDataResponse)]
    GetOracleData {},
    /// Returns: OraclePubkeyResponse
    #[returns(OraclePubkeyResponse)]
    GetOraclePubkey {},
    /// Returns: AdminResponse
    #[returns(AdminResponse)]
    GetAdmin {},
}
