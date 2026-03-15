# @jonathanbulkeley/plugin-mycelia-signal

**Mycelia Signal sovereign price oracle plugin for ElizaOS.**

56 endpoints covering crypto pairs, FX rates, economic indicators, and commodities. Every response is cryptographically signed and independently verifiable. No API keys. No accounts. Pay per query via Lightning (L402) or USDC on Base (x402).

[![npm version](https://img.shields.io/npm/v/@jonathanbulkeley/plugin-mycelia-signal.svg)](https://www.npmjs.com/package/@jonathanbulkeley/plugin-mycelia-signal)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What is Mycelia Signal?

Mycelia Signal is a sovereign oracle — a price and data attestation service that signs every response with a cryptographic key. Agents and applications can verify that data came from Mycelia Signal and has not been tampered with, without trusting any intermediary.

- **L402 (Lightning):** Pay in sats. secp256k1 ECDSA signatures. Bitcoin-native.
- **x402 (USDC on Base):** Pay in USDC. Ed25519 signatures. EVM-native.
- **56 endpoints:** Crypto, FX, economic indicators, commodities.
- **Preview mode:** Append `/preview` to any endpoint for free unsigned sample data.

Docs: [myceliasignal.com/docs](https://myceliasignal.com/docs)

---

## Endpoints

### Crypto Pairs (18 pairs including VWAP)
BTC/USD, BTC/EUR, BTC/JPY (spot + VWAP), ETH/USD, ETH/EUR, ETH/JPY, SOL/USD, SOL/EUR, SOL/JPY, XRP/USD, ADA/USD, DOGE/USD

### Precious Metals (3 pairs)
XAU/USD, XAU/EUR, XAU/JPY

### FX Rates (16 pairs)
EUR/USD, EUR/JPY, EUR/GBP, EUR/CHF, EUR/CNY, EUR/CAD, GBP/USD, GBP/JPY, GBP/CHF, GBP/CNY, GBP/CAD, USD/JPY, USD/CHF, USD/CNY, USD/CAD, CHF/JPY, CHF/CAD, CNY/JPY, CNY/CAD, CAD/JPY

### US Economic Indicators (8 indicators)
CPI, CPI Core, Unemployment Rate, Nonfarm Payrolls, Fed Funds Rate, GDP, PCE, Yield Curve

### EU Economic Indicators (6 indicators)
HICP, HICP Core, HICP Services, Unemployment Rate, GDP, Employment

### Commodities (5 indicators)
WTI Crude, Brent Crude, Natural Gas, Copper, US Dollar Index (DXY)

### Pricing
| Category | x402 (USDC) | L402 (sats) |
|----------|-------------|-------------|
| Price pairs & FX | $0.01 | 10 sats |
| VWAP pairs | $0.02 | 20 sats |
| Economic indicators | $0.10 | 1000 sats |
| Commodities | $0.10 | 1000 sats |

---

## Installation

```bash
npm install @jonathanbulkeley/plugin-mycelia-signal
```

---

## Usage

### Free mode (preview data — no payment required)

The plugin works out of the box with no configuration. Agents can query any supported pair using natural language. Without a payment handler configured, the plugin fetches free unsigned preview data (up to 5 minutes stale).

```typescript
import { myceliaSignalPlugin } from '@jonathanbulkeley/plugin-mycelia-signal';

const agent = new AgentRuntime({
  plugins: [myceliaSignalPlugin],
  // ... other config
});
```

### Paid mode — L402 (Lightning)

Configure a Lightning payment handler to receive signed attestations:

```typescript
import { createMyceliaSignalPlugin } from '@jonathanbulkeley/plugin-mycelia-signal';

const plugin = createMyceliaSignalPlugin({
  lightningPreimageFetcher: async (invoice: string) => {
    // Pay the invoice with your Lightning node/wallet and return the preimage
    const preimage = await yourLightningNode.payInvoice(invoice);
    return preimage;
  },
});
```

### Paid mode — x402 (USDC on Base)

```typescript
import { createMyceliaSignalPlugin } from '@jonathanbulkeley/plugin-mycelia-signal';

const plugin = createMyceliaSignalPlugin({
  x402PaymentHandler: async (paymentDetails: unknown) => {
    // Sign and submit the USDC transfer on Base, return the X-Payment header value
    const header = await yourWallet.signX402Payment(paymentDetails);
    return header;
  },
});
```

---

## Example Queries

Agents respond to natural language. Examples:

- *"What's the Bitcoin price?"*
- *"Get me the BTC/USD VWAP"*
- *"What's the current EUR/USD rate?"*
- *"What's the gold price in USD?"*
- *"What's US CPI?"*
- *"Get the Fed Funds Rate"*
- *"What's the WTI crude oil price?"*
- *"What's the DXY?"*

---

## Response Format

Every paid response includes a signed canonical attestation:

```json
{
  "domain": "BTCUSD",
  "canonical": "v1|PRICE|BTCUSD|84231.50|USD|2|binance,bitstamp,coinbase,kraken,...|median|1741514400|482910",
  "signature": "<base64-encoded-signature>",
  "pubkey": "<public-key-hex>",
  "signing_scheme": "secp256k1_ecdsa"
}
```

The `canonical` string is the signed payload. Verify it independently using the public key at [myceliasignal.com/docs/keys](https://myceliasignal.com/docs/keys).

### Canonical Format
```
v1|PRICE|PAIR|PRICE|CURRENCY|DECIMALS|SOURCES|METHOD|TIMESTAMP|NONCE
```

See [Canonical Format docs](https://myceliasignal.com/docs/canonical-format) for full specification.

---

## Signature Verification

### L402 (secp256k1 ECDSA) — Python

```python
import hashlib, base64
from coincurve import PublicKey

def verify_l402(response: dict) -> bool:
    msg_hash = hashlib.sha256(response["canonical"].encode()).digest()
    pubkey = PublicKey(bytes.fromhex(response["pubkey"]))
    return pubkey.verify(base64.b64decode(response["signature"]), msg_hash, hasher=None)
```

### x402 (Ed25519) — Python

```python
import hashlib, base64
from nacl.signing import VerifyKey
from nacl.encoding import RawEncoder

def verify_x402(response: dict) -> bool:
    msg_hash = hashlib.sha256(response["canonical"].encode()).digest()
    vk = VerifyKey(bytes.fromhex(response["pubkey"]), encoder=RawEncoder)
    try:
        vk.verify(msg_hash, base64.b64decode(response["signature"]))
        return True
    except Exception:
        return False
```

Full verification guide: [myceliasignal.com/docs/verification](https://myceliasignal.com/docs/verification)

---

## Public Keys

Each GC node uses its own per-instance keypair:

| Node | Protocol | Public Key |
|------|----------|------------|
| US GC | L402 (secp256k1) | `03c1955b8c543494c4ecd86d167105bcc7ca9a91b8e06cb9d6601f2f55a89abfbf` |
| Asia GC | L402 (secp256k1) | `02b1377c30c7dcfcba428cf299c18782856a12eb4fab32b87081460f4ba2deab73` |
| US GC | x402 (Ed25519) | `f4f0e52b5f7b54831f965632bf1ebf72769beda4c4e3d36a593f7729ec812615` |
| Asia GC | x402 (Ed25519) | `7ab07fbe7d08cd16823e5eb0db0e21f3f38e9366d5fd00d14e95df0fb9b51a1a` |

Full public keys page: [myceliasignal.com/docs/keys](https://myceliasignal.com/docs/keys)

---

## Links

- **Website:** [myceliasignal.com](https://myceliasignal.com)
- **Docs:** [myceliasignal.com/docs](https://myceliasignal.com/docs)
- **npm:** [npmjs.com/package/@jonathanbulkeley/plugin-mycelia-signal](https://www.npmjs.com/package/@jonathanbulkeley/plugin-mycelia-signal)
- **GitHub:** [github.com/jonathanbulkeley/elizaos-plugin-mycelia-signal](https://github.com/jonathanbulkeley/elizaos-plugin-mycelia-signal)
- **API:** [api.myceliasignal.com](https://api.myceliasignal.com)

---

## License

MIT
