# Monad Validators

Validator and staking explorer for **Monad mainnet (chain 143)** and **testnet (chain 10143)**.

Live: https://monad-validators.vercel.app

Everything on the site is read from the Monad **staking precompile** (`0x…1000`) through public RPC, with no indexer database. A small collector job records who proposed each block so the site can show real block-production performance per validator.

## What it shows

**Validators** — the full active set (top 200 by stake) plus candidates, sortable by stake, share, commission and block production:
- status derived from the three on-chain sets: `active` (consensus + snapshot), `joining` (in snapshot only, enters next epoch), `leaving` (in consensus only), `candidate` (registered but outside the top 200);
- consensus stake and network share, commission, auth address, registry name and logo from [monad-developers/validator-info](https://github.com/monad-developers/validator-info), VDP participation;
- **blocks proposed in the last 24 h vs. blocks expected from stake share**. MonadBFT leader selection is stake-weighted, so a healthy validator sits near 100 %; a validator that is down or missing rounds falls below;
- network totals: consensus stake, median commission, Nakamoto coefficient, block time, epoch progress.

**Validator page** — on-chain record (stakes in the execution / snapshot / consensus views, commission, flags, secp and BLS keys), 7-day hourly production chart against the expected line, per-epoch history with stake and share, delegator list with stakes and unclaimed rewards.

**Epoch & set changes** — epoch progress and boundary ETA, validators joining and leaving the active set next epoch, candidates outside the set with the stake gap to entry, recent epochs with observed blocks and top proposer.

**Delegator lookup** — every validator an address delegates to: active stake, stake pending activation (with the epoch it activates), unclaimed rewards, pending withdrawal requests and whether they are already withdrawable.

**JSON API** — every page is backed by a cached, CORS-enabled endpoint (`/api/<network>/validators`, `/validator/<id>`, `/epoch`, `/delegator/<address>`, `/blocks`). See `/mainnet/api`.

## How it works

```
                     ┌──────────────────────────────┐
  public RPC  ─────► │ Next.js app (Vercel)          │ ◄──── visitors / API clients
  (eth_call to       │  viem + Multicall3            │
   staking precompile│  unstable_cache 20–60 s       │
   + Multicall3)     └──────────────┬───────────────┘
                                    │ reads raw JSON
                     ┌──────────────▼───────────────┐
  public RPC  ─────► │ collector (GitHub Actions,    │
  getProposerValId   │  every 10 min) → `data` branch│
  per block          └──────────────────────────────┘
```

- **Live data**: validator sets are paginated from the precompile, then all validators are fetched with one Multicall3 `eth_call` per 100 ids. Results are cached server-side for 60 s (30 s for delegator pages), so traffic spikes cost a handful of RPC calls.
- **History**: `collector/collect.ts` asks `getProposerValId()` at every block since the previous run (about 2,000 blocks per 10 minutes at 0.3 s block time), folds the answers into hourly buckets (7 days) and per-epoch records (30 epochs, including a consensus-stake snapshot of every validator), refreshes the validator registry every 6 hours, and force-pushes a single JSON file per network to the `data` branch. The app fetches that file with a 2-minute cache.
- No API keys, no database, no paid services. Runs on the free tiers of Vercel and GitHub Actions.

## Running locally

```bash
npm install
npm run dev              # http://localhost:3000

# optional: build history locally and point the app at it
npx tsx collector/collect.ts mainnet --in data --out data
npx tsx collector/collect.ts testnet --in data --out data
(cd data && python3 -m http.server 8971) &
HISTORY_BASE_URL=http://127.0.0.1:8971 npm run dev
```

Environment variables (all optional):

| Variable | Purpose |
| --- | --- |
| `HISTORY_BASE_URL` | Base URL of the history JSON files (default: the `data` branch of this repo on raw.githubusercontent.com). |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL for metadata. |

## Deploying

1. Fork or push this repository to GitHub.
2. Import it in Vercel (framework preset: Next.js, no settings needed). `vercel.json` disables deployments for the `data` branch.
3. Enable the **Collect history** workflow under Actions (it runs every 10 minutes and needs no secrets beyond the default `GITHUB_TOKEN`).
4. If the repository is not `Gabbe-x/monad-validators`, set `HISTORY_BASE_URL` in Vercel to `https://raw.githubusercontent.com/<owner>/<repo>/data`.

## Data notes

- Stake amounts are MON (18 decimals). Commission is stored on-chain as an 18-decimal fraction; the site shows percent.
- "Expected blocks" = observed blocks in the window × validator's share of consensus stake. Only blocks the collector actually scanned are counted, so the first hours after deployment and any gap in collection reduce both numbers equally.
- Epoch boundaries are detected by binary search on `getEpoch()` when the collector notices the epoch changed; the first recorded epoch is partial.
- `flags` is shown raw; the docs do not define its bits. Non-zero values are labelled *flagged*.

## License

MIT
