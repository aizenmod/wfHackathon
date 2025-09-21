import { OracleClient, OracleQueryClient } from "./sdk/Oracle.client"
import { fromHex, toUtf8 } from "@cosmjs/encoding";
import { Secp256k1, sha256 } from "@cosmjs/crypto";
import * as dotenv from "dotenv"
import { getQueryClient, getClient } from "./setup";
import asyncHandler from "express-async-handler"
import { computeRisk, getRecentTransactions } from "./aml";

dotenv.config()

var oracle_client: OracleClient
var query_client: OracleQueryClient
var priv_key: string

const getOracleData = asyncHandler(async (req, res, next) => {
    try {
        const pubkey = await query_client.getOracleData()
        res.json(pubkey);
    } catch (error) {
        next(error);
    }
});

const updateOracleData = asyncHandler(async (req, res, next) => {
    try {
        const { msg } = req.query;
        const msgBytes = toUtf8(msg as string); 
        const msgHash = sha256(msgBytes);
        const signature = await Secp256k1.createSignature(msgHash, fromHex(priv_key));

        // Convert ExtendedSig → 64 bytes r||s
        const rs = signature.toFixedLength().slice(0, 64);
        console.log("byte length: ", rs.byteLength)

        const signatureBase64 = Buffer.from(rs).toString('base64');
        console.log("r||s signature (base64):", signatureBase64);

        const result = await oracle_client.oracleDataUpdate({data: msg as string, signature: signatureBase64})
        console.log(result)
        res.sendStatus(200)
    } catch (error) {
        next(error);
    }
});

const getTransactions = asyncHandler(async (req, res, next) => {
    try {
        const { wallet, chain, limit } = req.query as any;
        const txs = await getRecentTransactions({ wallet, chain, limit: limit ? Number(limit) : undefined });
        res.json({ wallet, chain, txs });
    } catch (error) {
        next(error);
    }
});

const evaluateAml = asyncHandler(async (req, res, next) => {
    try {
        const { wallet, chain, maxRisk, ttlSeconds } = req.body as any;
        const assessment = await computeRisk({ wallet, chain });

        const expires = Math.floor(Date.now() / 1000) + (ttlSeconds ? Number(ttlSeconds) : 300);
        const canonical = `${wallet}|${chain}|${assessment.risk}|${expires}`;
        const msgBytes = toUtf8(canonical);
        const msgHash = sha256(msgBytes);
        const signature = await Secp256k1.createSignature(msgHash, fromHex(priv_key));
        const rs = signature.toFixedLength().slice(0, 64);
        const signatureBase64 = Buffer.from(rs).toString('base64');

        res.json({
            wallet,
            chain,
            risk: assessment.risk,
            compliant: assessment.compliant,
            signals: assessment.signals,
            expires,
            signature: signatureBase64,
            maxRisk: maxRisk ? Number(maxRisk) : undefined
        });
    } catch (error) {
        next(error);
    }
});

const sendWithAml = asyncHandler(async (req, res, next) => {
    try {
        const { recipient, wallet, chain, maxRisk, risk, expires, signature } = req.body as any;
        const result = await oracle_client.sendWithAmlCheck({
            recipient,
            wallet,
            chain,
            maxRisk: Number(maxRisk),
            risk: Number(risk),
            expires: Number(expires),
            signature
        });
        res.json(result);
    } catch (error) {
        next(error);
    }
});

(async () => {
    priv_key = process.env.ORACLE_PRIVKEY!
    oracle_client = await getClient();
    query_client = await getQueryClient();
})();

export {
    getOracleData,
    updateOracleData,
    getTransactions,
    evaluateAml,
    sendWithAml
}