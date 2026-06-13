export interface DatasetRef {
  name: string;
  html_url: string;
  pushed_at: string;
}

export interface RunResult {
  status: 'success' | 'failure' | 'other';
  date: string;
}

export interface MetaInfo {
  title: string;
  frequency: string;
  source_name: string;
  source_url: string;
}

export interface SeriesInfo {
  count: number;
  sparkline: number[];
}

export interface GitProvider {
  listDatasets(): Promise<DatasetRef[]>;
  getMeta(datasetName: string): Promise<MetaInfo | null>;
  getSeriesInfo(datasetName: string): Promise<SeriesInfo | null>;
  getRecentRuns(datasetName: string, n: number): Promise<RunResult[]>;
}

// Shape of the generated status.json
export interface DatasetStatus extends DatasetRef {
  title: string;
  frequency: string;
  source_name: string;
  source_url: string;
  series_count: number | null;
  sparkline: number[];
  runs: RunResult[];
}

export interface StatusFile {
  generated_at: string;
  datasets: DatasetStatus[];
}
