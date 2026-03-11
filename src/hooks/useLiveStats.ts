/**
 * useLiveStats — fetches live Bitcoin + OPNet network data.
 *
 * Sources:
 *  - BTC price/market  → CoinGecko public API (no key needed)
 *  - Bitcoin fees      → mempool.space mainnet API
 *  - OPNet block/epoch → OPNet testnet JSON-RPC (via JSONRpcProvider)
 */

import { useState, useEffect, useCallback } from 'react';
import { JSONRpcProvider } from 'opnet';
import { networks } from '@btc-vision/bitcoin';
import { OPNET_TESTNET_RPC } from '../config/contract';

export interface BtcMarket {
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
}

export interface BtcFees {
  fastest: number;
  halfHour: number;
  hour: number;
  economy: number;
}

export interface BtcBlock {
  height: number;
  timestamp: number;
  txCount: number;
  sizeMB: number;
  miner: string;
}

export interface BtcMempoolStats {
  count: number;
  vsizeMB: number;
  totalFeeBTC: number;
  congestion: 'low' | 'medium' | 'high';
}

export interface OpnetStats {
  blockNumber: number;
  mempoolCount: number;
  opnetMempoolCount: number;
  epochNumber: number;
  epochStartBlock: number;
  epochEndBlock: number;
}

export interface LiveStats {
  btcMarket: BtcMarket | null;
  btcFees: BtcFees | null;
  btcBlock: BtcBlock | null;
  btcMempool: BtcMempoolStats | null;
  opnet: OpnetStats | null;
  lastUpdated: Date | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const provider = new JSONRpcProvider({ url: OPNET_TESTNET_RPC, network: networks.opnetTestnet });

async function fetchBtcMarket(): Promise<BtcMarket> {
  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true',
    { signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) throw new Error('CoinGecko request failed');
  const json = await res.json() as { bitcoin: { usd: number; usd_24h_change: number; usd_market_cap: number; usd_24h_vol: number } };
  const b = json.bitcoin;
  return {
    price:     b.usd,
    change24h: b.usd_24h_change,
    marketCap: b.usd_market_cap,
    volume24h: b.usd_24h_vol,
  };
}

async function fetchBtcFees(): Promise<BtcFees> {
  const res = await fetch(
    'https://mempool.space/api/v1/fees/recommended',
    { signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) throw new Error('mempool.space request failed');
  const json = await res.json() as { fastestFee: number; halfHourFee: number; hourFee: number; economyFee: number };
  return {
    fastest:  json.fastestFee,
    halfHour: json.halfHourFee,
    hour:     json.hourFee,
    economy:  json.economyFee,
  };
}

async function fetchLatestBlock(): Promise<BtcBlock> {
  const res = await fetch(
    'https://mempool.space/api/v1/blocks',
    { signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) throw new Error('mempool.space blocks request failed');
  const blocks = await res.json() as Array<{
    height: number;
    timestamp: number;
    tx_count: number;
    size: number;
    extras?: { pool?: { name: string } };
  }>;
  const b = blocks[0];
  return {
    height:    b.height,
    timestamp: b.timestamp,
    txCount:   b.tx_count,
    sizeMB:    b.size / 1_000_000,
    miner:     b.extras?.pool?.name ?? 'Unknown',
  };
}

async function fetchMempoolStats(): Promise<BtcMempoolStats> {
  const res = await fetch(
    'https://mempool.space/api/mempool',
    { signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) throw new Error('mempool.space mempool request failed');
  const json = await res.json() as { count: number; vsize: number; total_fee: number };
  const vsizeMB = json.vsize / 1_000_000;
  const congestion: BtcMempoolStats['congestion'] =
    vsizeMB > 20 ? 'high' : vsizeMB > 5 ? 'medium' : 'low';
  return {
    count:        json.count,
    vsizeMB,
    totalFeeBTC:  json.total_fee / 1e8,
    congestion,
  };
}

async function fetchOpnetStats(): Promise<OpnetStats> {
  // Block number
  const rawBlock = await (provider as unknown as { getBlockNumber: () => Promise<unknown> }).getBlockNumber();
  const blockNumber = typeof rawBlock === 'string'
    ? parseInt(rawBlock as string, 16)
    : Number(rawBlock);

  // Mempool info via provider
  const mempoolRaw = await (provider as unknown as { getMempoolInfo: () => Promise<unknown> }).getMempoolInfo().catch(() => null);
  const mempool = (mempoolRaw as { count: number; opnetCount: number } | null) ?? { count: 0, opnetCount: 0 };

  // Latest epoch via provider
  const epochRaw = await (provider as unknown as { getLatestEpoch: () => Promise<unknown> }).getLatestEpoch().catch(() => null);
  const epoch = (epochRaw as { epochNumber: string; startBlock: string; endBlock: string } | null)
    ?? { epochNumber: '0', startBlock: '0', endBlock: '0' };

  return {
    blockNumber,
    mempoolCount:       mempool.count,
    opnetMempoolCount:  mempool.opnetCount,
    epochNumber:        Number(epoch.epochNumber),
    epochStartBlock:    Number(epoch.startBlock),
    epochEndBlock:      Number(epoch.endBlock),
  };
}

export function useLiveStats(): LiveStats {
  const [btcMarket,   setBtcMarket]   = useState<BtcMarket | null>(null);
  const [btcFees,     setBtcFees]     = useState<BtcFees | null>(null);
  const [btcBlock,    setBtcBlock]    = useState<BtcBlock | null>(null);
  const [btcMempool,  setBtcMempool]  = useState<BtcMempoolStats | null>(null);
  const [opnet,       setOpnet]       = useState<OpnetStats | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [marketResult, feesResult, blockResult, mempoolResult, opnetResult] = await Promise.allSettled([
      fetchBtcMarket(),
      fetchBtcFees(),
      fetchLatestBlock(),
      fetchMempoolStats(),
      fetchOpnetStats(),
    ]);

    if (marketResult.status  === 'fulfilled') setBtcMarket(marketResult.value);
    if (feesResult.status    === 'fulfilled') setBtcFees(feesResult.value);
    if (blockResult.status   === 'fulfilled') setBtcBlock(blockResult.value);
    if (mempoolResult.status === 'fulfilled') setBtcMempool(mempoolResult.value);
    if (opnetResult.status   === 'fulfilled') setOpnet(opnetResult.value);

    const results = [marketResult, feesResult, blockResult, mempoolResult, opnetResult];
    const anyFailed = results.some((r) => r.status === 'rejected');
    if (anyFailed) {
      const msgs = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
        .join('; ');
      setError(`Some data failed to load: ${msgs}`);
    }

    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  // Initial fetch + 30s auto-refresh
  useEffect(() => {
    void fetchAll();
    const id = setInterval(() => { void fetchAll(); }, 30_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  return { btcMarket, btcFees, btcBlock, btcMempool, opnet, lastUpdated, loading, error, refresh: fetchAll };
}
