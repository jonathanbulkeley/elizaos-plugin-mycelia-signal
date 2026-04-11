/**
 * Mycelia Signal Plugin for ElizaOS
 *
 * Cryptographically signed price attestations for 66 endpoints:
 * crypto pairs, FX rates, economic indicators, and commodities.
 * Pay per query via Lightning (L402) or USDC on Base (x402).
 * Every response is independently verifiable. No vendor trust required.
 *
 * Docs: https://myceliasignal.com/docs
 */

import type {
  Plugin,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  Action,
  Provider,
  ActionExample,
  ProviderResult,
} from "@elizaos/core";

const BASE_URL = "https://api.myceliasignal.com";

const PAIRS: Record<string, { endpoint: string; description: string }> = {
  // ── Crypto spot ──────────────────────────────────────────────────────────
  BTCUSD:      { endpoint: "/oracle/price/btc/usd",      description: "Bitcoin / US Dollar spot price" },
  BTCUSD_VWAP: { endpoint: "/oracle/price/btc/usd/vwap", description: "Bitcoin / US Dollar 5-min VWAP" },
  BTCEUR:      { endpoint: "/oracle/price/btc/eur",      description: "Bitcoin / Euro spot price" },
  BTCEUR_VWAP: { endpoint: "/oracle/price/btc/eur/vwap", description: "Bitcoin / Euro 5-min VWAP" },
  BTCJPY:      { endpoint: "/oracle/price/btc/jpy",      description: "Bitcoin / Japanese Yen spot price" },
  ETHUSD:      { endpoint: "/oracle/price/eth/usd",      description: "Ethereum / US Dollar spot price" },
  ETHEUR:      { endpoint: "/oracle/price/eth/eur",      description: "Ethereum / Euro spot price" },
  ETHJPY:      { endpoint: "/oracle/price/eth/jpy",      description: "Ethereum / Japanese Yen spot price" },
  SOLUSD:      { endpoint: "/oracle/price/sol/usd",      description: "Solana / US Dollar spot price" },
  SOLEUR:      { endpoint: "/oracle/price/sol/eur",      description: "Solana / Euro spot price" },
  SOLJPY:      { endpoint: "/oracle/price/sol/jpy",      description: "Solana / Japanese Yen spot price" },
  XRPUSD:      { endpoint: "/oracle/price/xrp/usd",      description: "XRP / US Dollar spot price" },
  ADAUSD:      { endpoint: "/oracle/price/ada/usd",      description: "Cardano / US Dollar spot price" },
  DOGEUSD:     { endpoint: "/oracle/price/doge/usd",     description: "Dogecoin / US Dollar spot price" },
  // ── Stablecoin pegs ───────────────────────────────────────────────────────
  USDTUSD:     { endpoint: "/oracle/price/usdt/usd",     description: "Tether / US Dollar peg" },
  USDCUSD:     { endpoint: "/oracle/price/usdc/usd",     description: "USD Coin / US Dollar peg" },
  USDTEUR:     { endpoint: "/oracle/price/usdt/eur",     description: "Tether / Euro peg" },
  USDTJPY:     { endpoint: "/oracle/price/usdt/jpy",     description: "Tether / Japanese Yen peg" },
  // ── Additional VWAP ───────────────────────────────────────────────────────
  ETHUSD_VWAP: { endpoint: "/oracle/price/eth/usd/vwap", description: "Ethereum / US Dollar 5-min VWAP" },
  BTCEUR_VWAP: { endpoint: "/oracle/price/btc/eur/vwap", description: "Bitcoin / Euro 5-min VWAP" },
  // ── Precious metals ───────────────────────────────────────────────────────
  XAUUSD:      { endpoint: "/oracle/price/xau/usd",      description: "Gold / US Dollar spot price" },
  XAUEUR:      { endpoint: "/oracle/price/xau/eur",      description: "Gold / Euro spot price" },
  XAUJPY:      { endpoint: "/oracle/price/xau/jpy",      description: "Gold / Japanese Yen spot price" },
  // ── FX pairs ──────────────────────────────────────────────────────────────
  EURUSD:      { endpoint: "/oracle/price/eur/usd",      description: "Euro / US Dollar spot price" },
  EURJPY:      { endpoint: "/oracle/price/eur/jpy",      description: "Euro / Japanese Yen spot price" },
  EURGBP:      { endpoint: "/oracle/price/eur/gbp",      description: "Euro / British Pound spot price" },
  EURCHF:      { endpoint: "/oracle/price/eur/chf",      description: "Euro / Swiss Franc spot price" },
  EURCNY:      { endpoint: "/oracle/price/eur/cny",      description: "Euro / Chinese Yuan spot price" },
  EURCAD:      { endpoint: "/oracle/price/eur/cad",      description: "Euro / Canadian Dollar spot price" },
  GBPUSD:      { endpoint: "/oracle/price/gbp/usd",      description: "British Pound / US Dollar spot price" },
  GBPJPY:      { endpoint: "/oracle/price/gbp/jpy",      description: "British Pound / Japanese Yen spot price" },
  GBPCHF:      { endpoint: "/oracle/price/gbp/chf",      description: "British Pound / Swiss Franc spot price" },
  GBPCNY:      { endpoint: "/oracle/price/gbp/cny",      description: "British Pound / Chinese Yuan spot price" },
  GBPCAD:      { endpoint: "/oracle/price/gbp/cad",      description: "British Pound / Canadian Dollar spot price" },
  USDJPY:      { endpoint: "/oracle/price/usd/jpy",      description: "US Dollar / Japanese Yen spot price" },
  USDCHF:      { endpoint: "/oracle/price/usd/chf",      description: "US Dollar / Swiss Franc spot price" },
  USDCNY:      { endpoint: "/oracle/price/usd/cny",      description: "US Dollar / Chinese Yuan spot price" },
  USDCAD:      { endpoint: "/oracle/price/usd/cad",      description: "US Dollar / Canadian Dollar spot price" },
  CHFJPY:      { endpoint: "/oracle/price/chf/jpy",      description: "Swiss Franc / Japanese Yen spot price" },
  CHFCAD:      { endpoint: "/oracle/price/chf/cad",      description: "Swiss Franc / Canadian Dollar spot price" },
  CNYJPY:      { endpoint: "/oracle/price/cny/jpy",      description: "Chinese Yuan / Japanese Yen spot price" },
  CNYCAD:      { endpoint: "/oracle/price/cny/cad",      description: "Chinese Yuan / Canadian Dollar spot price" },
  CADJPY:      { endpoint: "/oracle/price/cad/jpy",      description: "Canadian Dollar / Japanese Yen spot price" },
  // ── US Economic Indicators ────────────────────────────────────────────────
  US_CPI:        { endpoint: "/oracle/econ/us/cpi",         description: "US CPI (headline inflation, BLS)" },
  US_CPI_CORE:   { endpoint: "/oracle/econ/us/cpi_core",    description: "US CPI Core (ex food & energy, BLS)" },
  US_UNRATE:     { endpoint: "/oracle/econ/us/unrate",      description: "US Unemployment Rate (BLS)" },
  US_NFP:        { endpoint: "/oracle/econ/us/nfp",         description: "US Nonfarm Payrolls (BLS)" },
  US_FEDFUNDS:   { endpoint: "/oracle/econ/us/fedfunds",    description: "US Federal Funds Rate (FRED)" },
  US_GDP:        { endpoint: "/oracle/econ/us/gdp",         description: "US GDP (BEA/FRED)" },
  US_PCE:        { endpoint: "/oracle/econ/us/pce",         description: "US PCE Price Index (BEA/FRED)" },
  US_YIELD_CURVE:{ endpoint: "/oracle/econ/us/yield_curve", description: "US 10Y-2Y Yield Curve Spread (FRED)" },
  // ── EU Economic Indicators ────────────────────────────────────────────────
  EU_HICP:         { endpoint: "/oracle/econ/eu/hicp",          description: "EU HICP Headline Inflation (Eurostat)" },
  EU_HICP_CORE:    { endpoint: "/oracle/econ/eu/hicp_core",     description: "EU HICP Core Inflation (Eurostat)" },
  EU_HICP_SERVICES:{ endpoint: "/oracle/econ/eu/hicp_services", description: "EU HICP Services Inflation (Eurostat)" },
  EU_UNRATE:       { endpoint: "/oracle/econ/eu/unrate",        description: "EU Unemployment Rate (Eurostat)" },
  EU_GDP:          { endpoint: "/oracle/econ/eu/gdp",           description: "EU GDP (Eurostat)" },
  EU_EMPLOYMENT:   { endpoint: "/oracle/econ/eu/employment",    description: "EU Employment (Eurostat)" },
  // ── Commodities ───────────────────────────────────────────────────────────
  WTI:    { endpoint: "/oracle/econ/commodities/wti",    description: "WTI Crude Oil price (EIA/FRED)" },
  BRENT:  { endpoint: "/oracle/econ/commodities/brent",  description: "Brent Crude Oil price (EIA/FRED)" },
  NATGAS: { endpoint: "/oracle/econ/commodities/natgas", description: "Henry Hub Natural Gas price (EIA/FRED)" },
  COPPER: { endpoint: "/oracle/econ/commodities/copper", description: "Copper price (FRED)" },
  DXY:    { endpoint: "/oracle/econ/commodities/dxy",    description: "US Dollar Index (Federal Reserve)" },
};

interface OracleResponse {
  domain?: string;
  canonical?: string;
  canonicalstring?: string;  // econ endpoints use canonicalstring
  signature: string;
  pubkey: string;
  signing_scheme?: string;
  // econ-specific fields
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

function parseCanonical(canonical: string): ParsedAttestation {
  const parts = canonical.split("|");
  // v1|TYPE|<payload>|TIMESTAMP|NONCE
  // PRICE: v1|PRICE|PAIR|PRICE|CURRENCY|DECIMALS|SOURCES|METHOD|TIMESTAMP|NONCE
  const type = parts[1] ?? "";
  if (type === "PRICE") {
    return {
      version:   parts[0],
      type:      parts[1],
      pair:      parts[2],
      price:     parts[3],
      currency:  parts[4],
      decimals:  parts[5],
      sources:   parts[6]?.split(",") ?? [],
      method:    parts[7],
      timestamp: parts[8],
      nonce:     parts[9],
    };
  }
  // ECON/COMMODITIES — return best-effort
  return {
    version:   parts[0],
    type:      parts[1],
    pair:      `${parts[2]}/${parts[3]}`,
    price:     parts[4],
    currency:  parts[5],
    decimals:  "",
    sources:   [parts[8] ?? ""],
    method:    parts[10] ?? "",
    timestamp: parts[11] ?? "",
    nonce:     parts[12] ?? "",
  };
}

function getCanonical(raw: OracleResponse): string {
  return raw.canonical ?? raw.canonicalstring ?? "";
}

function isOracleResponse(data: unknown): data is OracleResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "signature" in data &&
    "pubkey" in data &&
    (("canonical" in data) || ("canonicalstring" in data))
  );
}

async function fetchAttestation(
  endpoint: string,
  config: PluginConfig = {}
): Promise<{ attestation: OracleResponse; parsed: ParsedAttestation } | null> {
  const url = `${BASE_URL}${endpoint}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });

    if (response.ok) {
      const raw: unknown = await response.json();
      if (!isOracleResponse(raw)) return null;
      return { attestation: raw, parsed: parseCanonical(getCanonical(raw)) };
    }

    if (response.status === 402) {
      const wwwAuth = response.headers.get("WWW-Authenticate");
      const xPaymentResponse = response.headers.get("X-Payment-Response");

      if (wwwAuth && config.lightningMacaroon && config.lightningPreimageFetcher) {
        const invoiceMatch = wwwAuth.match(/invoice="([^"]+)"/);
        const macaroonMatch = wwwAuth.match(/macaroon="([^"]+)"/);
        if (invoiceMatch && macaroonMatch) {
          const preimage = await config.lightningPreimageFetcher(invoiceMatch[1]);
          const paid = await fetch(url, {
            headers: { "Authorization": `L402 ${macaroonMatch[1]}:${preimage}` },
            signal: AbortSignal.timeout(20000),
          });
          if (paid.ok) {
            const raw: unknown = await paid.json();
            if (!isOracleResponse(raw)) return null;
            return { attestation: raw, parsed: parseCanonical(getCanonical(raw)) };
          }
        }
      }

      if (xPaymentResponse && config.x402PaymentHandler) {
        const details: unknown = JSON.parse(xPaymentResponse);
        const header = await config.x402PaymentHandler(details);
        const paid = await fetch(url, {
          headers: { "X-Payment": header },
          signal: AbortSignal.timeout(20000),
        });
        if (paid.ok) {
          const raw: unknown = await paid.json();
          if (!isOracleResponse(raw)) return null;
          return { attestation: raw, parsed: parseCanonical(getCanonical(raw)) };
        }
      }
    }

    return null;
  } catch (err) {
    console.error(`[mycelia-signal] error fetching ${endpoint}:`, err);
    return null;
  }
}

function formatMessage(parsed: ParsedAttestation, raw: OracleResponse): string {
  const isEcon = parsed.type === "ECON" || parsed.type === "COMMODITIES";

  if (isEcon) {
    return [
      `**${parsed.pair}**: ${parsed.price} ${parsed.currency}`,
      `Period: ${parsed.method}`,
      `Source: ${parsed.sources.join(", ")}`,
      `Signature: ${raw.signature.substring(0, 16)}...`,
      `Verify: https://myceliasignal.com/docs/verification`,
    ].join("\n");
  }

  const price = parseFloat(parsed.price).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const symbol = parsed.currency === "USD" ? "$" : parsed.currency === "EUR" ? "€" : "";
  const ts = parseInt(parsed.timestamp)
    ? new Date(parseInt(parsed.timestamp) * 1000).toUTCString()
    : parsed.timestamp;

  return [
    `**${parsed.pair}** ${parsed.method.toUpperCase()}: ${symbol}${price} ${parsed.currency}`,
    `Timestamp: ${ts}`,
    `Sources (${parsed.sources.length}): ${parsed.sources.join(", ")}`,
    `Signature: ${raw.signature.substring(0, 16)}... (${raw.signing_scheme ?? "secp256k1_ecdsa"})`,
    `Verify: https://myceliasignal.com/docs/verification`,
  ].join("\n");
}

const PAIR_KEYWORDS: Record<string, string[]> = {
  BTCUSD:       ["btc", "bitcoin", "btcusd", "bitcoin price", "btc price", "btc usd"],
  BTCUSD_VWAP:  ["btc vwap", "bitcoin vwap", "vwap bitcoin", "btc usd vwap"],
  BTCEUR:       ["btceur", "btc eur", "bitcoin euro", "btc euro"],
  BTCEUR_VWAP:  ["btceur vwap", "bitcoin euro vwap"],
  BTCJPY:       ["btcjpy", "btc jpy", "bitcoin yen", "btc yen"],
  ETHUSD:       ["eth", "ethereum", "ethusd", "eth price", "ethereum price", "eth usd"],
  ETHEUR:       ["etheur", "eth eur", "ethereum euro"],
  ETHJPY:       ["ethjpy", "eth jpy", "ethereum yen"],
  SOLUSD:       ["sol", "solana", "solusd", "sol price", "solana price", "sol usd"],
  SOLEUR:       ["soleur", "sol eur", "solana euro"],
  SOLJPY:       ["soljpy", "sol jpy", "solana yen"],
  XRPUSD:       ["xrp", "ripple", "xrpusd", "xrp price"],
  ADAUSD:       ["ada", "cardano", "adausd", "ada price", "cardano price"],
  DOGEUSD:      ["doge", "dogecoin", "dogeusd", "doge price"],
  XAUUSD:       ["gold", "xau", "xauusd", "gold price", "xau usd"],
  XAUEUR:       ["xaueur", "xau eur", "gold euro"],
  XAUJPY:       ["xaujpy", "xau jpy", "gold yen"],
  EURUSD:       ["eurusd", "eur/usd", "euro dollar", "euro usd", "eur usd"],
  EURJPY:       ["eurjpy", "eur jpy", "euro yen"],
  EURGBP:       ["eurgbp", "eur gbp", "euro pound"],
  EURCHF:       ["eurchf", "eur chf", "euro franc"],
  EURCNY:       ["eurcny", "eur cny", "euro yuan"],
  EURCAD:       ["eurcad", "eur cad", "euro cad"],
  GBPUSD:       ["gbpusd", "gbp usd", "pound dollar", "cable"],
  GBPJPY:       ["gbpjpy", "gbp jpy", "pound yen"],
  GBPCHF:       ["gbpchf", "gbp chf", "pound franc"],
  GBPCNY:       ["gbpcny", "gbp cny", "pound yuan"],
  GBPCAD:       ["gbpcad", "gbp cad", "pound cad"],
  USDJPY:       ["usdjpy", "usd jpy", "dollar yen", "usd/jpy"],
  USDCHF:       ["usdchf", "usd chf", "dollar franc"],
  USDCNY:       ["usdcny", "usd cny", "dollar yuan"],
  USDCAD:       ["usdcad", "usd cad", "dollar cad", "loonie"],
  CHFJPY:       ["chfjpy", "chf jpy", "franc yen"],
  CHFCAD:       ["chfcad", "chf cad"],
  CNYJPY:       ["cnyjpy", "cny jpy", "yuan yen"],
  CNYCAD:       ["cnycad", "cny cad"],
  CADJPY:       ["cadjpy", "cad jpy", "cad yen"],
  US_CPI:       ["us cpi", "cpi", "inflation", "us inflation", "consumer price"],
  US_CPI_CORE:  ["core cpi", "cpi core", "core inflation"],
  US_UNRATE:    ["us unemployment", "unemployment rate", "jobless rate"],
  US_NFP:       ["nfp", "nonfarm payrolls", "payrolls", "jobs report"],
  US_FEDFUNDS:  ["fed funds", "federal funds", "fed rate", "interest rate"],
  US_GDP:       ["us gdp", "gdp", "economic growth"],
  US_PCE:       ["pce", "personal consumption", "pce inflation"],
  US_YIELD_CURVE:["yield curve", "10y 2y", "10y-2y", "treasury spread"],
  EU_HICP:      ["eu hicp", "hicp", "eu inflation", "eurozone inflation"],
  EU_HICP_CORE: ["eu core inflation", "hicp core"],
  EU_HICP_SERVICES:["eu services inflation", "hicp services"],
  EU_UNRATE:    ["eu unemployment", "eurozone unemployment"],
  EU_GDP:       ["eu gdp", "eurozone gdp"],
  EU_EMPLOYMENT:["eu employment", "eurozone employment"],
  WTI:          ["wti", "crude oil", "oil price", "west texas"],
  BRENT:        ["brent", "brent crude", "brent oil"],
  NATGAS:       ["natgas", "natural gas", "henry hub"],
  COPPER:       ["copper", "copper price"],
  DXY:          ["dxy", "dollar index", "us dollar index"],
  USDTUSD:     ["usdt", "tether", "usdt usd", "tether price", "usdt peg"],
  USDCUSD:     ["usdc", "usd coin", "usdc usd", "usdc price", "usdc peg"],
  USDTEUR:     ["usdt eur", "tether euro"],
  USDTJPY:     ["usdt jpy", "tether yen"],
  ETHUSD_VWAP: ["eth vwap", "ethereum vwap", "vwap ethereum", "eth usd vwap"],
  BTCEUR_VWAP: ["btceur vwap", "bitcoin euro vwap", "btc eur vwap"],
};

function createPriceAction(pair: string, config: PluginConfig): Action {
  const pairInfo = PAIRS[pair];
  const keywords = PAIR_KEYWORDS[pair] ?? [pair.toLowerCase()];

  const examples: ActionExample[][] = [[
    { name: "user",  content: { text: `What is the ${pair} price?` } },
    { name: "agent", content: { text: `Fetching ${pairInfo.description} from Mycelia Signal...` } },
  ]];

  return {
    name: `GET_PRICE_${pair}`,
    description: `Get the current ${pairInfo.description} from Mycelia Signal — cryptographically signed and independently verifiable`,
    similes: keywords.map(k => `get ${k} price`),
    examples,

    validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
      const text = (message.content?.text ?? "").toLowerCase();
      return keywords.some(k => text.includes(k));
    },

    handler: async (
      _runtime: IAgentRuntime,
      _message: Memory,
      _state: State | undefined,
      _options: unknown,
      callback?: HandlerCallback
    ): Promise<void> => {
      const result = await fetchAttestation(pairInfo.endpoint, config);

      if (!result) {
        if (callback) {
          await callback({
            text: `Unable to fetch ${pair}. Payment may be required — configure L402 or x402 handler. See https://myceliasignal.com/docs/quickstart`,
          });
        }
        return;
      }

      if (callback) {
        await callback({
          text: formatMessage(result.parsed, result.attestation),
          content: {
            pair:      result.parsed.pair,
            price:     result.parsed.price,
            currency:  result.parsed.currency,
            timestamp: result.parsed.timestamp,
            sources:   result.parsed.sources,
            method:    result.parsed.method,
            signature: result.attestation.signature,
            pubkey:    result.attestation.pubkey,
            canonical: getCanonical(result.attestation),
          },
        });
      }
    },
  };
}

function createPriceProvider(config: PluginConfig): Provider {
  return {
    name: "mycelia-signal-price-provider",
    get: async (
      _runtime: IAgentRuntime,
      message: Memory,
      _state: State
    ): Promise<ProviderResult> => {
      const text = (message.content?.text ?? "").toLowerCase();

      let targetPair: string | null = null;
      for (const [pair, keywords] of Object.entries(PAIR_KEYWORDS)) {
        if (keywords.some(k => text.includes(k))) {
          targetPair = pair;
          break;
        }
      }

      if (!targetPair || !PAIRS[targetPair]) return { text: "" };

      const result = await fetchAttestation(PAIRS[targetPair].endpoint, config);
      if (!result) return { text: "" };

      return {
        text: `Current ${result.parsed.pair}: ${result.parsed.price} ${result.parsed.currency} (${result.parsed.method}, ${result.parsed.sources.length} sources, signed, ${result.parsed.timestamp})`,
        data: {
          pair:      result.parsed.pair,
          price:     result.parsed.price,
          currency:  result.parsed.currency,
          timestamp: result.parsed.timestamp,
          sources:   result.parsed.sources,
          canonical: getCanonical(result.attestation),
        },
      };
    },
  };
}

function createMSVIAction(config: PluginConfig): Action {
  return {
    name: "GET_MSVI",
    description: "Get the Mycelia Signal Volatility Index (MSVI) for BTC or ETH. Five-component composite: Realized Vol (Parkinson 30D), Implied Vol (Deribit ATM), Term Structure (7D/90D), Funding Rate signal, Put/Call Ratio. Output: 0-100 index. Ed25519 signed.",
    similes: ["msvi", "volatility index", "crypto volatility", "btc volatility", "eth volatility", "vol index"],
    examples: [[
      { name: "user",  content: { text: "What is the MSVI for BTC?" } },
      { name: "agent", content: { text: "Fetching Mycelia Signal Volatility Index for BTC..." } },
    ]],
    validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
      const t = (message.content?.text ?? "").toLowerCase();
      return ["msvi", "volatility index", "vol index", "crypto volatility", "btc volatility", "eth volatility"].some(k => t.includes(k));
    },
    handler: async (_runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: unknown, callback?: HandlerCallback): Promise<void> => {
      const text = (message.content?.text ?? "").toLowerCase();
      const isEth = text.includes("eth") || text.includes("ethereum");
      const endpoint = isEth ? "/oracle/volatility/eth/usd" : "/oracle/volatility/btc/usd";
      const pair = isEth ? "ETHUSD" : "BTCUSD";
      const result = await fetchAttestation(endpoint, config);
      if (callback) {
        if (result) {
          const parts = getCanonical(result.attestation).split("|");
          await callback({
            text: [`**MSVI ${pair}**: ${parts[4] ?? "?"} (${parts[5] ?? "index"})`, `Components: ${parts[7] ?? ""}`, `Confidence: ${parts[8]?.replace("CONFIDENCE:", "") ?? ""}`, `Signature: ${result.attestation.signature?.substring(0, 16)}...`, `Docs: https://myceliasignal.com/docs/indices/`].join("\n"),
            content: { pair, canonical: getCanonical(result.attestation), signature: result.attestation.signature },
          });
        } else {
          await callback({ text: "Unable to fetch MSVI. Payment may be required. See https://myceliasignal.com/docs/indices/" });
        }
      }
    },
  };
}

function createMSXIAction(config: PluginConfig): Action {
  return {
    name: "GET_MSXI",
    description: "Get the Mycelia Signal Sentiment Index (MSXI) for BTC or ETH. Five-component composite: Funding Rate direction, Options Skew (25D risk reversal), Put/Call Ratio, Term Structure slope, Cross-exchange Basis. Output: -100 to +100. Positive=bullish, negative=bearish. Ed25519 signed.",
    similes: ["msxi", "sentiment index", "market sentiment", "btc sentiment", "eth sentiment", "crypto sentiment", "positioning"],
    examples: [[
      { name: "user",  content: { text: "What is the market sentiment for BTC?" } },
      { name: "agent", content: { text: "Fetching Mycelia Signal Sentiment Index for BTC..." } },
    ]],
    validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
      const t = (message.content?.text ?? "").toLowerCase();
      return ["msxi", "sentiment index", "market sentiment", "btc sentiment", "eth sentiment", "crypto sentiment", "positioning"].some(k => t.includes(k));
    },
    handler: async (_runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: unknown, callback?: HandlerCallback): Promise<void> => {
      const text = (message.content?.text ?? "").toLowerCase();
      const isEth = text.includes("eth") || text.includes("ethereum");
      const endpoint = isEth ? "/oracle/sentiment/eth/usd" : "/oracle/sentiment/btc/usd";
      const pair = isEth ? "ETHUSD" : "BTCUSD";
      const result = await fetchAttestation(endpoint, config);
      if (callback) {
        if (result) {
          const parts = getCanonical(result.attestation).split("|");
          await callback({
            text: [`**MSXI ${pair}**: ${parts[4] ?? "?"} — ${parts[7]?.replace("REGIME:", "") ?? ""}`, `Components: ${parts[6] ?? ""}`, `Confidence: ${parts[8]?.replace("CONFIDENCE:", "") ?? ""}`, `Signature: ${result.attestation.signature?.substring(0, 16)}...`, `Docs: https://myceliasignal.com/docs/indices/`].join("\n"),
            content: { pair, canonical: getCanonical(result.attestation), signature: result.attestation.signature },
          });
        } else {
          await callback({ text: "Unable to fetch MSXI. Payment may be required. See https://myceliasignal.com/docs/indices/" });
        }
      }
    },
  };
}

function createMSSIAction(config: PluginConfig): Action {
  return {
    name: "GET_MSSI",
    description: "Get the Mycelia Signal Stress Index (MSSI) — market-wide systemic stress indicator. Three components: Volatility Regime (MSVI average), Stablecoin Stress (USDT/USDC peg deviation), Funding Extremity (absolute z-score). Output: 0-100. Regimes: CALM/ELEVATED/HIGH/EXTREME. Ed25519 signed.",
    similes: ["mssi", "stress index", "market stress", "crypto stress", "systemic stress", "stress level"],
    examples: [[
      { name: "user",  content: { text: "What is the current market stress level?" } },
      { name: "agent", content: { text: "Fetching Mycelia Signal Stress Index..." } },
    ]],
    validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
      const t = (message.content?.text ?? "").toLowerCase();
      return ["mssi", "stress index", "market stress", "crypto stress", "systemic stress", "stress level"].some(k => t.includes(k));
    },
    handler: async (_runtime: IAgentRuntime, _message: Memory, _state: State | undefined, _options: unknown, callback?: HandlerCallback): Promise<void> => {
      const result = await fetchAttestation("/oracle/stress/market", config);
      if (callback) {
        if (result) {
          const parts = getCanonical(result.attestation).split("|");
          await callback({
            text: [`**MSSI MARKET**: ${parts[4] ?? "?"} — ${parts[7]?.replace("REGIME:", "") ?? ""}`, `Components: ${parts[6] ?? ""}`, `Confidence: ${parts[8]?.replace("CONFIDENCE:", "") ?? ""}`, `Signature: ${result.attestation.signature?.substring(0, 16)}...`, `Docs: https://myceliasignal.com/docs/indices/`].join("\n"),
            content: { scope: "MARKET", canonical: getCanonical(result.attestation), signature: result.attestation.signature },
          });
        } else {
          await callback({ text: "Unable to fetch MSSI. Payment may be required. See https://myceliasignal.com/docs/indices/" });
        }
      }
    },
  };
}

// ── DLC ACTIONS ─────────────────────────────────────────────────────────────

interface DLCThresholdRequest {
  pair: string;
  strike: number;
  direction: "above" | "below";
  expiry?: number;
  webhookUrl?: string;
}

interface DLCThresholdResponse {
  status: string;
  eventid: string;
  pair: string;
  strike: number;
  direction: string;
  expiry: number;
  oraclePubkey: string;
  rpoints: string[];
  webhookUrl?: string;
  rail: string;
  docs?: string;
}

interface DLCAttestationResponse {
  eventid: string;
  outcome: string;
  attestedAt: string;
  signature?: string;
  oraclePubkey?: string;
}

interface DLCAnnouncement {
  eventid: string;
  pair?: string;
  type?: string;
  expiry?: number;
  strike?: number;
  direction?: string;
}

async function fetchDLCFree<T>(endpoint: string): Promise<T | null> {
  try {
    const r = await fetch(`${BASE_URL}${endpoint}`, { signal: AbortSignal.timeout(20000) });
    if (r.ok) return await r.json() as T;
    return null;
  } catch (err) {
    console.error(`[mycelia-signal] DLC fetch error ${endpoint}:`, err);
    return null;
  }
}

async function postDLCWithPayment(
  endpoint: string,
  body: unknown,
  config: PluginConfig
): Promise<DLCThresholdResponse | null> {
  const url = `${BASE_URL}${endpoint}`;
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  };
  try {
    const r = await fetch(url, init);
    if (r.ok) return await r.json() as DLCThresholdResponse;

    if (r.status === 402) {
      const data = await r.json() as { l402?: { invoice: string; macaroon: string }; x402?: unknown };

      if (data.l402 && config.lightningPreimageFetcher && config.lightningMacaroon) {
        const preimage = await config.lightningPreimageFetcher(data.l402.invoice);
        const paid = await fetch(url, {
          ...init,
          headers: { ...init.headers, "Authorization": `L402 ${data.l402.macaroon}:${preimage}` },
        });
        if (paid.ok) return await paid.json() as DLCThresholdResponse;
      }

      if (data.x402 && config.x402PaymentHandler) {
        const header = await config.x402PaymentHandler(data.x402);
        const paid = await fetch(url, {
          ...init,
          headers: { ...init.headers, "X-Payment": header },
        });
        if (paid.ok) return await paid.json() as DLCThresholdResponse;
      }
    }
    return null;
  } catch (err) {
    console.error(`[mycelia-signal] DLC post error ${endpoint}:`, err);
    return null;
  }
}

function createDLCPreviewAction(config: PluginConfig): Action {
  return {
    name: "DLC_THRESHOLD_PREVIEW",
    description: "Register a free DLC threshold contract preview with Mycelia Signal. Tests the full integration flow without payment. Requires: pair (e.g. BTCUSD), strike (price level), direction (above/below), optional expiry (Unix timestamp).",
    similes: ["dlc preview", "test dlc", "dlc threshold preview", "free dlc contract", "preview threshold contract"],
    examples: [[
      { name: "user",  content: { text: "Test a DLC threshold contract for BTC above 90000" } },
      { name: "agent", content: { text: "Registering a free DLC threshold preview with Mycelia Signal..." } },
    ]],
    validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
      const t = (message.content?.text ?? "").toLowerCase();
      return ["dlc preview", "test dlc", "preview threshold", "dlc test"].some(k => t.includes(k));
    },
    handler: async (
      _runtime: IAgentRuntime,
      message: Memory,
      _state: State | undefined,
      _options: unknown,
      callback?: HandlerCallback
    ): Promise<void> => {
      const text = message.content?.text ?? "";
      const strikeMatch = text.match(/\b(\d{4,8})\b/);
      const dirMatch = text.toLowerCase().includes("below") ? "below" : "above";
      const pairMatch = text.toUpperCase().match(/\b(BTC|ETH|SOL|XRP|ADA|DOGE|XAU)(USD|EUR|JPY)\b/);
      const pair = pairMatch ? `${pairMatch[1]}${pairMatch[2]}` : "BTCUSD";
      const strike = strikeMatch ? parseInt(strikeMatch[1]) : 80000;
      const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;

      const result = await postDLCWithPayment(
        "/dlc/oracle/threshold/preview",
        { pair, strike, direction: dirMatch, expiry },
        config
      );

      if (callback) {
        if (result) {
          await callback({
            text: [
              `**DLC Preview Registered** (free — no payment)`,
              `Pair: ${result.pair} | Strike: ${result.strike} | Direction: ${result.direction}`,
              `Event ID: ${result.eventid}`,
              `Expiry: ${new Date(result.expiry * 1000).toUTCString()}`,
              `Oracle pubkey: ${result.oraclePubkey?.substring(0, 16)}...`,
              `Docs: https://myceliasignal.com/docs/dlc`,
            ].join("\n"),
            content: result,
          });
        } else {
          await callback({ text: "Unable to register DLC preview. See https://myceliasignal.com/docs/dlc" });
        }
      }
    },
  };
}

function createDLCThresholdAction(config: PluginConfig): Action {
  return {
    name: "DLC_REGISTER_THRESHOLD",
    description: "Register a production DLC threshold contract with Mycelia Signal. Payment required: 10,000 sats (L402) or $7.00 USDC (x402). Requires: pair (e.g. BTCUSD), strike price, direction (above/below), optional expiry timestamp and webhook URL.",
    similes: ["register dlc", "dlc threshold contract", "register threshold", "new dlc contract", "create dlc"],
    examples: [[
      { name: "user",  content: { text: "Register a DLC threshold contract for BTC above 90000" } },
      { name: "agent", content: { text: "Registering a DLC threshold contract with Mycelia Signal..." } },
    ]],
    validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
      const t = (message.content?.text ?? "").toLowerCase();
      return ["register dlc", "dlc threshold", "dlc contract", "create dlc"].some(k => t.includes(k)) &&
             !t.includes("preview");
    },
    handler: async (
      _runtime: IAgentRuntime,
      message: Memory,
      _state: State | undefined,
      _options: unknown,
      callback?: HandlerCallback
    ): Promise<void> => {
      const text = message.content?.text ?? "";
      const strikeMatch = text.match(/\b(\d{4,8})\b/);
      const dirMatch = text.toLowerCase().includes("below") ? "below" : "above";
      const pairMatch = text.toUpperCase().match(/\b(BTC|ETH|SOL|XRP|ADA|DOGE|XAU)(USD|EUR|JPY)\b/);
      const pair = pairMatch ? `${pairMatch[1]}${pairMatch[2]}` : "BTCUSD";
      const strike = strikeMatch ? parseInt(strikeMatch[1]) : 80000;
      const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;

      const result = await postDLCWithPayment(
        "/dlc/oracle/threshold",
        { pair, strike, direction: dirMatch, expiry },
        config
      );

      if (callback) {
        if (result) {
          await callback({
            text: [
              `**DLC Threshold Contract Registered**`,
              `Pair: ${result.pair} | Strike: ${result.strike} | Direction: ${result.direction}`,
              `Event ID: ${result.eventid}`,
              `Expiry: ${new Date(result.expiry * 1000).toUTCString()}`,
              `Oracle pubkey: ${result.oraclePubkey?.substring(0, 16)}...`,
              `Payment rail: ${result.rail}`,
              `Docs: https://myceliasignal.com/docs/dlc`,
            ].join("\n"),
            content: result,
          });
        } else {
          await callback({ text: "Unable to register DLC contract. Payment may be required — configure L402 or x402 handler. See https://myceliasignal.com/docs/dlc" });
        }
      }
    },
  };
}

function createDLCAttestationAction(): Action {
  return {
    name: "DLC_GET_ATTESTATION",
    description: "Retrieve the Schnorr attestation for a settled DLC contract from Mycelia Signal. Free endpoint. Requires event ID.",
    similes: ["dlc attestation", "get dlc attestation", "dlc result", "fetch dlc attestation", "check dlc"],
    examples: [[
      { name: "user",  content: { text: "Get the DLC attestation for event abc123" } },
      { name: "agent", content: { text: "Fetching DLC attestation from Mycelia Signal..." } },
    ]],
    validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
      const t = (message.content?.text ?? "").toLowerCase();
      return ["attestation", "dlc result", "check dlc", "get dlc"].some(k => t.includes(k));
    },
    handler: async (
      _runtime: IAgentRuntime,
      message: Memory,
      _state: State | undefined,
      _options: unknown,
      callback?: HandlerCallback
    ): Promise<void> => {
      const text = message.content?.text ?? "";
      const eventIdMatch = text.match(/\b([a-zA-Z0-9_-]{8,})\b/g);
      const eventId = eventIdMatch?.find(id => id.length >= 8 && !/^(get|the|for|dlc|event|attestation)$/i.test(id));

      if (!eventId) {
        if (callback) await callback({ text: "Please provide a DLC event ID. Example: 'Get attestation for event BTCUSD-2026-04-01T00:00:00Z'" });
        return;
      }

      const result = await fetchDLCFree<DLCAttestationResponse>(`/dlc/oracle/attestations/${eventId}`);

      if (callback) {
        if (result) {
          await callback({
            text: [
              `**DLC Attestation**`,
              `Event ID: ${result.eventid}`,
              `Outcome: ${result.outcome}`,
              `Attested at: ${result.attestedAt}`,
              result.signature ? `Signature: ${result.signature.substring(0, 16)}...` : "",
              `Verify: https://myceliasignal.com/docs/verification`,
            ].filter(Boolean).join("\n"),
            content: result,
          });
        } else {
          await callback({ text: `No attestation found for event ID: ${eventId}. The contract may not have settled yet (HTTP 425 = not yet attested).` });
        }
      }
    },
  };
}

function createDLCAnnouncementsAction(): Action {
  return {
    name: "DLC_LIST_ANNOUNCEMENTS",
    description: "List all active DLC announcements from Mycelia Signal oracle. Free endpoint. Returns numeric and threshold contract announcements.",
    similes: ["list dlc", "dlc announcements", "active dlc contracts", "show dlc contracts", "dlc oracle announcements"],
    examples: [[
      { name: "user",  content: { text: "List active DLC announcements" } },
      { name: "agent", content: { text: "Fetching DLC announcements from Mycelia Signal..." } },
    ]],
    validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
      const t = (message.content?.text ?? "").toLowerCase();
      return ["dlc announcement", "list dlc", "active dlc", "show dlc"].some(k => t.includes(k));
    },
    handler: async (
      _runtime: IAgentRuntime,
      _message: Memory,
      _state: State | undefined,
      _options: unknown,
      callback?: HandlerCallback
    ): Promise<void> => {
      const result = await fetchDLCFree<{ announcements: DLCAnnouncement[] }>("/dlc/oracle/announcements");

      if (callback) {
        if (result?.announcements?.length) {
          const lines = result.announcements.slice(0, 10).map(a =>
            `— ${a.eventid}${a.pair ? ` | ${a.pair}` : ""}${a.strike ? ` | strike: ${a.strike} ${a.direction}` : ""}`
          );
          if (result.announcements.length > 10) lines.push(`...and ${result.announcements.length - 10} more`);
          await callback({
            text: [`**Active DLC Announcements** (${result.announcements.length} total)`, ...lines, `Docs: https://myceliasignal.com/docs/dlc`].join("\n"),
            content: result,
          });
        } else {
          await callback({ text: "No active DLC announcements found. See https://myceliasignal.com/docs/dlc" });
        }
      }
    },
  };
}

export function createMyceliaSignalPlugin(config: PluginConfig = {}): Plugin {
  return {
    name: "@elizaos/plugin-mycelia-signal",
    description:
      "Mycelia Signal sovereign oracle — 66 endpoints: price/FX/macro/commodity plus MSVI volatility, MSXI sentiment, and MSSI stress indices, plus Bitcoin DLC oracle. Cryptographically signed attestations via Lightning (L402) or USDC on Base (x402). Every response independently verifiable. No vendor trust required.",
    actions: [
      ...Object.keys(PAIRS).map(pair => createPriceAction(pair, config)),
      createMSVIAction(config),
      createMSXIAction(config),
      createMSSIAction(config),
      createDLCPreviewAction(config),
      createDLCThresholdAction(config),
      createDLCAttestationAction(),
      createDLCAnnouncementsAction(),
    ],
    providers: [createPriceProvider(config)],
  };
}

export const myceliaSignalPlugin = createMyceliaSignalPlugin();
export default myceliaSignalPlugin;
export type { OracleResponse, ParsedAttestation };
