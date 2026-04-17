# Remit

Tuition payments, settled in under a second.

Remit is a tuition payment portal built on [Arc](https://arc.network), Circle's L1 blockchain purpose-built for stablecoin finance. Students can deposit from any chain, swap currencies on-chain, and pay tuition with sub-second deterministic finality -- all with zero gas costs.

## What it demonstrates

| Feature | What it proves |
|---|---|
| **Deterministic Finality** | Tuition payment confirmed and irreversible in <1 second |
| **Stable Fee Design** | Every transaction costs ~$0.01 in native USDC |
| **CCTP** | Deposit USDC from 27+ chains with zero protocol fees |
| **StableFX** | On-chain EURC/USDC/JPYC swap at 0.1% spread (vs. 3-5% traditional) |
| **Smart Contract Accounts** | Zero-cost wallet creation, no seed phrase |
| **Gas Station** | Platform sponsors all gas -- students pay $0.00 |

## Demo flow

1. **Landing** (`/`) -- value proposition and speed/cost/reach comparison
2. **Create account** (`/demo`) -- enter a name, get a Smart Contract Account on Arc
3. **Dashboard** (`/dashboard`) -- balances, invoices, quick actions
4. **Deposit** (`/dashboard/deposit`) -- pick a source chain from 27 CCTP-supported networks, watch the 4-step bridge animation (approve, burn, attest, mint)
5. **Pay tuition** (`/dashboard/pay/[id]`) -- confirm payment, see sub-second finality receipt
6. **Swap** (`/dashboard/swap`) -- convert EURC/JPYC to USDC via StableFX with a savings comparison panel
7. **University view** (`/university`) -- incoming payments, settlement stats

All blockchain operations are mocked via database for the demo. No real transactions are executed.

## Stack

- **Next.js 15** with App Router
- **tRPC 11** for type-safe API
- **Prisma** with SQLite
- **Tailwind CSS 4**
- **TypeScript**

## Getting started

```bash
npm install
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## SCBC Hackathon 2026

Built for the Circle programmable money hackathon. Projects must use Arc as the underlying blockchain.
