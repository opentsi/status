import type { Dataset, DatasetMeta, RunResult } from './types';

const ISO_PREFIX = /^[a-z]{2}\./;

export async function fetchDatasets(): Promise<Dataset[]> {
  const res = await fetch(
    'https://api.github.com/orgs/opentsi/repos?type=public&per_page=100'
  );
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const repos: Dataset[] = await res.json();
  return repos
    .filter((r) => ISO_PREFIX.test(r.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const FREQ: Record<string, string> = {
  D: 'Daily',
  W: 'Weekly',
  M: 'Monthly',
  Q: 'Quarterly',
  Y: 'Yearly',
  I: 'Irregular'
};

export async function fetchRuns(repoName: string, n = 5): Promise<RunResult[]> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/opentsi/${repoName}/actions/runs?per_page=${n}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.workflow_runs ?? []).slice(0, n).map(
      (r: { conclusion: string | null; created_at: string }): RunResult => ({
        status:
          r.conclusion === 'success' ? 'success'
          : r.conclusion === 'failure' || r.conclusion === 'timed_out' ? 'failure'
          : 'other',
        date: r.created_at
      })
    );
  } catch {
    return [];
  }
}

export interface RepoStats {
  sparkline: number[];
  seriesCount: number;
}

export async function fetchRepoStats(repoName: string): Promise<RepoStats | null> {
  for (const branch of ['master', 'main']) {
    try {
      const res = await fetch(
        `https://api.github.com/repos/opentsi/${repoName}/contents/data-raw/csv?ref=${branch}`
      );
      if (!res.ok) continue;
      const files: { name: string; download_url: string }[] = await res.json();
      const csvFiles = files.filter(f => f.name.endsWith('.csv'));
      const seriesCount = csvFiles.length;
      const first = csvFiles[0];
      if (!first) return { sparkline: [], seriesCount };
      const csv = await (await fetch(first.download_url)).text();
      return { sparkline: parseCsvSparkline(csv), seriesCount };
    } catch {
      continue;
    }
  }
  return null;
}

function parseCsvSparkline(csv: string): number[] {
  const lines = csv.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const dataLines = lines.slice(1).slice(-24);
  const sample = dataLines[0].split(',');
  let col = 1;
  for (let i = 1; i < sample.length; i++) {
    if (!isNaN(parseFloat(sample[i].replace(/"/g, '')))) { col = i; break; }
  }
  return dataLines
    .map(l => parseFloat(l.split(',')[col]?.replace(/"/g, '') ?? ''))
    .filter(v => !isNaN(v));
}

export async function fetchMeta(repoName: string): Promise<DatasetMeta | null> {
  for (const branch of ['master', 'main']) {
    try {
      const res = await fetch(
        `https://raw.githubusercontent.com/opentsi/${repoName}/${branch}/inst/metadata.json`
      );
      if (!res.ok) continue;
      const m = await res.json();
      return {
        title: m.title?.en ?? '',
        frequency: FREQ[m.dataset_frequency] ?? m.dataset_frequency ?? '—',
        source_name: m.source_name?.en ?? '',
        source_url: m.source_url ?? ''
      };
    } catch {
      continue;
    }
  }
  return null;
}
