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


## Stack

- **Next.js 15** with App Router
- **Browser session state** via `sessionStorage`
- **Tailwind CSS 4**
- **TypeScript**

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Persistence model

- Reloading the same tab keeps the active student, balances, invoices, and activity history.
- Reset clears the current browser session and returns the app to the landing page.
- Opening a new tab or a fresh browser context starts empty.

## SCBC Hackathon 2026

Built for the Circle programmable money hackathon. Projects must use Arc as the underlying blockchain.
