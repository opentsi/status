import type { GitProvider, DatasetRef, MetaInfo, SeriesInfo, RunResult } from './interface.ts';

const FREQ: Record<string, string> = {
  D: 'Daily', W: 'Weekly', M: 'Monthly', Q: 'Quarterly', Y: 'Yearly', I: 'Irregular'
};

const ISO_PREFIX = /^[a-z]{2}\./;

export class GitHubProvider implements GitProvider {
  private org: string;
  private headers: Record<string, string>;

  constructor(org: string, token: string) {
    this.org = org;
    this.headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  private async api(path: string) {
    const res = await fetch(`https://api.github.com${path}`, { headers: this.headers });
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${path}`);
    return res.json();
  }

  private async raw(repo: string, filePath: string): Promise<string | null> {
    for (const branch of ['master', 'main']) {
      const res = await fetch(
        `https://raw.githubusercontent.com/${this.org}/${repo}/${branch}/${filePath}`
      );
      if (res.ok) return res.text();
    }
    return null;
  }

  async listDatasets(): Promise<DatasetRef[]> {
    const repos = await this.api(`/orgs/${this.org}/repos?type=public&per_page=100`);
    return (repos as DatasetRef[])
      .filter((r) => ISO_PREFIX.test(r.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getMeta(datasetName: string): Promise<MetaInfo | null> {
    const text = await this.raw(datasetName, 'inst/metadata.json');
    if (!text) return null;
    try {
      const m = JSON.parse(text);
      return {
        title: m.title?.en ?? '',
        frequency: FREQ[m.dataset_frequency] ?? m.dataset_frequency ?? '',
        source_name: m.source_name?.en ?? '',
        source_url: m.source_url ?? ''
      };
    } catch {
      return null;
    }
  }

  async getSeriesInfo(datasetName: string): Promise<SeriesInfo | null> {
    // Contents API is capped at 1000 entries — use Git Trees API instead.
    for (const branch of ['master', 'main']) {
      try {
        const rootTree: { tree: Array<{ path: string; sha: string }> } = await this.api(
          `/repos/${this.org}/${datasetName}/git/trees/${branch}`
        );
        const dataRawEntry = rootTree.tree.find(e => e.path === 'data-raw');
        if (!dataRawEntry) continue;

        const dataRawTree: { tree: Array<{ path: string; sha: string }> } = await this.api(
          `/repos/${this.org}/${datasetName}/git/trees/${dataRawEntry.sha}`
        );
        const csvDirEntry = dataRawTree.tree.find(e => e.path === 'csv');
        if (!csvDirEntry) continue;

        const csvTree: { tree: Array<{ path: string; sha: string }>; truncated: boolean } = await this.api(
          `/repos/${this.org}/${datasetName}/git/trees/${csvDirEntry.sha}`
        );
        if (csvTree.truncated) throw new Error(`git tree truncated for ${datasetName}`);
        const csvFiles = csvTree.tree.filter(e => e.path.endsWith('.csv'));
        if (csvFiles.length === 0) continue;

        const csvText = await this.raw(datasetName, `data-raw/csv/${csvFiles[0].path}`);
        return { count: csvFiles.length, sparkline: csvText ? parseCsvSparkline(csvText) : [] };
      } catch {
        continue;
      }
    }
    return null;
  }

  async getFirstCommitDate(datasetName: string): Promise<string | null> {
    try {
      let earliest: string | null = null;
      for (const branch of ['master', 'main']) {
        let url: string | null =
          `https://api.github.com/repos/${this.org}/${datasetName}/commits?sha=${branch}&per_page=100`;
        while (url) {
          const res = await fetch(url, { headers: this.headers });
          if (!res.ok) break;
          const batch: Array<{ commit: { author: { date: string }; committer: { date: string } } }> =
            await res.json();
          for (const c of batch) {
            const d = c.commit.author?.date ?? c.commit.committer?.date;
            if (d && (!earliest || d < earliest)) earliest = d;
          }
          const link = res.headers.get('Link') ?? '';
          url = link.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
        }
      }
      return earliest ? earliest.slice(0, 10) : null;
    } catch {
      return null;
    }
  }

  async getRecentRuns(datasetName: string, n: number): Promise<RunResult[]> {
    try {
      const data = await this.api(
        `/repos/${this.org}/${datasetName}/actions/runs?per_page=${n}`
      );
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
