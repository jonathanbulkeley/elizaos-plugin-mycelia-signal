/**
 * Mycelia Signal Plugin for ElizaOS
 *
 * Cryptographically signed price attestations for 56 endpoints:
 * crypto pairs, FX rates, economic indicators, and commodities.
 * Pay per query via Lightning (L402) or USDC on Base (x402).
 * Every response is independently verifiable. No vendor trust required.
 *
 * Docs: https://myceliasignal.com/docs
 */
import type { Plugin } from "@elizaos/core";
interface OracleResponse {
    domain?: string;
    canonical?: string;
    canonicalstring?: string;
    signature: string;
    pubkey: string;
    signing_scheme?: string;
    region?: string;
    indicator?: string;
    value?: string;
    unit?: string;
    period?: string;
}
interface ParsedAttestation {
    version: string;
    type: string;
    pair: string;
    price: string;
    currency: string;
    decimals: string;
    timestamp: string;
    nonce: string;
    sources: string[];
    method: string;
}
export interface PluginConfig {
    lightningPreimageFetcher?: (invoice: string) => Promise<string>;
    lightningMacaroon?: string;
    x402PaymentHandler?: (paymentDetails: unknown) => Promise<string>;
    preferL402?: boolean;
}
export declare function createMyceliaSignalPlugin(config?: PluginConfig): Plugin;
export declare const myceliaSignalPlugin: Plugin;
export default myceliaSignalPlugin;
export type { OracleResponse, ParsedAttestation };
//# sourceMappingURL=index.d.ts.map