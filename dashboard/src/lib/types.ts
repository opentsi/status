export interface Dataset {
  name: string;
  description: string | null;
  html_url: string;
  pushed_at: string;
}

export interface DatasetMeta {
  title: string;
  frequency: string;
  source_name: string;
  source_url: string;
}

export type RunStatus = 'success' | 'failure' | 'other';

export interface RunResult {
  status: RunStatus;
  date: string;
}

export type StatusLevel = 'good' | 'warn' | 'stale';
