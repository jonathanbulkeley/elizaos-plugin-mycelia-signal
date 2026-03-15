# @elizaos/plugin-mycelia-signal

Mycelia Signal sovereign price oracle plugin for ElizaOS.

Provides cryptographically signed price attestations for BTC, ETH, SOL, XAU, and EUR pairs. Every response is a canonical signed payload — pair, price, sources, aggregation method, timestamp, and nonce — independently verifiable against a known public key. No vendor trust required.

**Payment options:**
- **L402** — pay per query in Bitcoin sats via Lightning Network
- **x402** — pay per query in USDC on Base

No API keys. No subscriptions. No accounts.

---

## Supported Pairs

| Pair | Description | Cost (L402) | Cost (x402) |
|------|-------------|-------------|-------------|
| BTC/USD | Bitcoin / US Dollar spot | 10 sats | $0.001 |
| BTC/USD VWAP | Bitcoin / US Dollar 5-min VWAP | 20 sats | $0.002 |
| ETH/USD | Ethereum / US Dollar spot | 10 sats | $0.001 |
| EUR/USD | Euro / US Dollar spot | 10 sats | $0.001 |
| XAU/USD | Gold / US Dollar spot | 10 sats | $0.001 |
| SOL/USD | Solana / US Dollar spot | 10 sats | $0.001 |
| BTC/EUR | Bitcoin / Euro spot | 10 sats | $0.001 |
| BTC/EUR VWAP | Bitcoin / Euro 5-min VWAP | 20 sats | $0.002 |
| ETH/EUR | Ethereum / Euro spot | 10 sats | $0.001 |
| SOL/EUR | Solana / Euro spot | 10 sats | $0.001 |
| XAU/EUR | Gold / Euro spot | 10 sats | $0.001 |

---

## Installation

```bash
npm install @elizaos/plugin-mycelia-signal
```

---

## Usage

### Basic (no payment — free endpoints only)

```typescript
import { myceliaSignalPlugin } from "@elizaos/plugin-mycelia-signal";

// In your agent character config:
{
  plugins: [myceliaSignalPlugin]
}
```

### With x402 (USDC on Base)

```typescript
import { createMyceliaSignalPlugin } from "@elizaos/plugin-mycelia-signal";

const plugin = createMyceliaSignalPlugin({
  x402PaymentHandler: async (paymentDetails) => {
    // Use Coinbase AgentKit, Viem, or any EVM wallet to pay USDC on Base
    // Returns the X-Payment header value
    const payment = await yourWallet.payX402(paymentDetails);
    return payment.header;
  }
});
```

### With L402 (Lightning)

```typescript
import { createMyceliaSignalPlugin } from "@elizaos/plugin-mycelia-signal";

const plugin = createMyceliaSignalPlugin({
  preferL402: true,
  lightningMacaroon: "your-macaroon",
  lightningPreimageFetcher: async (invoice) => {
    // Use your Lightning wallet SDK to pay the invoice
    // Returns the payment preimage
    const result = await yourLightningWallet.payInvoice(invoice);
    return result.preimage;
  }
});
```

### With Coinbase AgentKit (recommended for AI agents)

```typescript
import { createMyceliaSignalPlugin } from "@elizaos/plugin-mycelia-signal";
import { CdpWalletProvider } from "@coinbase/agentkit";

// AgentKit wallet on Base — pays x402 natively
const walletProvider = await CdpWalletProvider.configureWithWallet({ /* ... */ });

const plugin = createMyceliaSignalPlugin({
  x402PaymentHandler: async (paymentDetails) => {
    // AgentKit handles x402 payment automatically
    return await walletProvider.payX402(paymentDetails);
  }
});
```

---

## Agent Actions

Once installed, your ElizaOS agent will respond to natural language queries about prices:

- *"What's the Bitcoin price?"* → fetches BTC/USD signed attestation
- *"Get me the ETH USD price"* → fetches ETH/USD signed attestation
- *"What's gold trading at?"* → fetches XAU/USD signed attestation
- *"SOL price in euros"* → fetches SOL/EUR signed attestation
- *"BTC VWAP"* → fetches BTC/USD 5-minute VWAP attestation

Each response includes:
- Current price
- UTC timestamp
- Sources used (exchange names)
- Aggregation method (median or VWAP)
- Cryptographic signature for independent verification
- Public key reference

---

## Response Format

The plugin returns structured content alongside the natural language response:

```json
{
  "pair": "BTCUSD",
  "price": "67125.10",
  "currency": "USD",
  "timestamp": "2026-03-05T14:07:07Z",
  "sources": ["binance", "bitstamp", "coinbase", "gemini", "kraken"],
  "method": "median",
  "signature": "<base64>",
  "pubkey": "<hex>",
  "canonical": "v1|BTCUSD|67125.10|USD|2|2026-03-05T14:07:07Z|890123|binance,bitstamp,coinbase,gemini,kraken|median"
}
```

The `canonical` field is the exact string that was signed. To verify independently:

```python
import base64, hashlib
from coincurve import PublicKey

canonical = "v1|BTCUSD|67125.10|..."
signature_b64 = "<signature from response>"
pubkey_hex = "<pubkey from response>"

msg_hash = hashlib.sha256(canonical.encode()).digest()
pub = PublicKey(bytes.fromhex(pubkey_hex))
sig = base64.b64decode(signature_b64)
valid = pub.verify(sig, msg_hash, hasher=None)
```

Full verification guide: https://myceliasignal.com/docs/verification

---

## Payment Protocols

### x402 (USDC on Base) — recommended for AI agents

The x402 protocol is purpose-built for machine-to-machine payments. The agent pays USDC on Base Mainnet and receives the signed attestation in the same HTTP exchange. Compatible with Coinbase AgentKit Agentic Wallets.

- Asset: USDC on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- Docs: https://myceliasignal.com/docs/x402

### L402 (Lightning Network) — for Bitcoin-native agents

The L402 protocol uses HTTP 402 with a Lightning invoice and macaroon. Pay the invoice, extract the preimage, resend the request.

- Cost: 10–20 sats per query
- Docs: https://myceliasignal.com/docs/l402

---

## Links

- **Documentation:** https://myceliasignal.com/docs
- **API Reference:** https://myceliasignal.com/openapi.json
- **Public Keys:** https://myceliasignal.com/docs/keys
- **GitHub:** https://github.com/jonathanbulkeley/mycelia-signal-sovereign-oracle
- **Support:** info@myceliasignal.com

---

## License

MIT
