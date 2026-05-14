import type { ReportReason } from './api';

const REPORTS_KEY = 'beggarsmap_reports';
const PRICE_VOTES_KEY = 'beggarsmap_price_votes';
const CP_VOTES_KEY = 'beggarsmap_cp_votes';

export type CpVote = 'high' | 'low';

function getReports(): Record<string, ReportReason> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(REPORTS_KEY) ?? '{}') as Record<string, ReportReason>;
  } catch {
    return {};
  }
}

function getPriceVotes(): Record<string, 'yes' | 'no'> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(PRICE_VOTES_KEY) ?? '{}') as Record<string, 'yes' | 'no'>;
  } catch {
    return {};
  }
}

export function hasReported(id: string): ReportReason | null {
  return getReports()[id] ?? null;
}

export function addReport(id: string, reason: ReportReason): boolean {
  if (hasReported(id)) return false;
  const reports = getReports();
  reports[id] = reason;
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
    return true;
  } catch {
    return false;
  }
}

export function getPriceVote(id: string): 'yes' | 'no' | null {
  return getPriceVotes()[id] ?? null;
}

export function setPriceVote(id: string, vote: 'yes' | 'no'): void {
  const votes = getPriceVotes();
  votes[id] = vote;
  try {
    localStorage.setItem(PRICE_VOTES_KEY, JSON.stringify(votes));
  } catch {
    // ignore
  }
}

// ── CP 值投票（每店只能投一次，可改投） ──
function getCpVotes(): Record<string, CpVote> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(CP_VOTES_KEY) ?? '{}') as Record<string, CpVote>;
  } catch {
    return {};
  }
}

export function getCpVote(id: string): CpVote | null {
  return getCpVotes()[id] ?? null;
}

export function setCpVote(id: string, vote: CpVote): void {
  const votes = getCpVotes();
  votes[id] = vote;
  try {
    localStorage.setItem(CP_VOTES_KEY, JSON.stringify(votes));
  } catch {
    // ignore
  }
}
