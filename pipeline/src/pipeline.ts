import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GitHubProvider } from './providers/github.ts';
import type { StatusFile } from './providers/interface.ts';

const ORG = 'opentsi';
const TOKEN = process.env.GITHUB_TOKEN ?? '';
const OUT = fileURLToPath(new URL('../../dashboard/static/status.json', import.meta.url));

if (!TOKEN) {
  console.error('GITHUB_TOKEN is not set');
  process.exit(1);
}

console.log(`Fetching datasets for org: ${ORG}`);
const provider = new GitHubProvider(ORG, TOKEN);
const datasets = await provider.listDatasets();
console.log(`Found ${datasets.length} datasets — fetching details...`);

const results = await Promise.all(
  datasets.map(async (dataset) => {
    const [meta, series, runs] = await Promise.all([
      provider.getMeta(dataset.name),
      provider.getSeriesInfo(dataset.name),
      provider.getRecentRuns(dataset.name, 5)
    ]);

    if (meta) process.stdout.write('.');
    else process.stdout.write('x');

    return {
      name: dataset.name,
      html_url: dataset.html_url,
      pushed_at: dataset.pushed_at,
      title: meta?.title ?? '',
      frequency: meta?.frequency ?? '',
      source_name: meta?.source_name ?? '',
      source_url: meta?.source_url ?? '',
      series_count: series?.count ?? null,
      sparkline: series?.sparkline ?? [],
      runs
    };
  })
);

process.stdout.write('\n');

const output: StatusFile = {
  generated_at: new Date().toISOString(),
  datasets: results
};

writeFileSync(OUT, JSON.stringify(output, null, 2));
console.log(`✓ Written ${results.length} datasets to ${OUT}`);
