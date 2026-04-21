# Remit

Tuition payments, settled in under a second.

Remit is a tuition payment portal built on [Arc](https://arc.network), Circle's L1 blockchain purpose-built for stablecoin finance. Students can deposit from any chain, swap currencies on-chain, and pay tuition with sub-second deterministic finality -- all with zero gas costs.

This demo now runs entirely in the browser. Student state is stored in `sessionStorage`, so it survives refreshes in the same tab or window session but does not sync to a new tab or browser context.

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
4. **Deposit** (`/dashboard`) -- open the inline deposit workflow, pick a source chain, and watch the bridge timeline resolve into wallet balances
5. **Pay tuition** (`/dashboard`) -- confirm the current balance payment directly from the dashboard
6. **Swap** (`/dashboard`) -- convert EURC/JPYC to USDC via StableFX with the inline swap workflow
7. **University view** (`/university`) -- incoming payments, settlement stats

All blockchain operations are mocked in browser session state. No real transactions are executed.

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
