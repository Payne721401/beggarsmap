import type { ReportReason } from './api';

const REPORTS_KEY = 'beggarsmap_reports';
const PRICE_VOTES_KEY = 'beggarsmap_price_votes';

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
