import { query } from './db';

export interface TxRecord {
  hash?: string;
  block_timestamp?: string;
  from?: string;
  to?: string;
  value?: string | number;
  chain: 'eth' | 'btc';
}

export async function getRecentTransactions(opts: { wallet: string; chain: 'eth' | 'btc'; limit?: number }): Promise<TxRecord[]> {
  const { wallet, chain } = opts;
  const limit = opts.limit ?? 20;

  if (chain === 'eth') {
    const { rows } = await query<any>(
      `
      SELECT hash, block_timestamp, fromm_address as from, to_address as to, value
      FROM transactions
      WHERE lower(fromm_address) = lower($1) OR lower(to_address) = lower($1)
      ORDER BY block_timestamp DESC
      LIMIT $2
      `,
      [wallet, limit]
    );
    return rows.map(r => ({ hash: r.hash, block_timestamp: r.block_timestamp, from: r.from, to: r.to, value: r.value, chain: 'eth' }));
  }

  // btc: addresses stored as comma/array-like text; use ILIKE for containment heuristic
  const { rows } = await query<any>(
    `
    SELECT transaction_hash as hash, block_timestamp
    FROM (
      SELECT transaction_hash, block_timestamp FROM inputs WHERE addresses ILIKE '%' || $1 || '%'
      UNION ALL
      SELECT transaction_hash, block_timestamp FROM outputs WHERE addresses ILIKE '%' || $1 || '%'
    ) t
    ORDER BY block_timestamp DESC
    LIMIT $2
    `,
    [wallet, limit]
  );
  return rows.map(r => ({ hash: r.hash, block_timestamp: r.block_timestamp, chain: 'btc' }));
}

export interface RiskAssessment {
  risk: number; // 0-10
  compliant: boolean;
  signals: Record<string, number>;
}

export async function computeRisk(opts: { wallet: string; chain: 'eth' | 'btc' }): Promise<RiskAssessment> {
  const txs = await getRecentTransactions({ wallet: opts.wallet, chain: opts.chain, limit: 20 });

  // Simple heuristic: fewer txs and recent large values raise risk slightly
  const txCount = txs.length;
  const recentTs = txs[0]?.block_timestamp ? new Date(txs[0].block_timestamp).getTime() : 0;
  const ageHours = recentTs ? (Date.now() - recentTs) / 3600000 : 9999;

  let valueSignal = 0;
  if (opts.chain === 'eth') {
    const total = txs.reduce((sum, t) => sum + (Number(t.value ?? 0) || 0), 0);
    valueSignal = isFinite(total) ? Math.min(10, Math.log10(1 + total)) : 0;
  }

  const activitySignal = txCount < 3 ? 5 : txCount < 10 ? 3 : 1;
  const freshnessSignal = ageHours < 1 ? 4 : ageHours < 24 ? 2 : 0;

  const raw = activitySignal + freshnessSignal + valueSignal;
  const risk = Math.max(0, Math.min(10, Math.round(raw)));

  return { risk, compliant: risk <= 5, signals: { txCount, ageHours, valueSignal, activitySignal, freshnessSignal } as any };
}
