<script lang="ts">
  import type { RunStatus } from '$lib/types';

  let { status, date }: { status: RunStatus | null; date?: string } = $props();

  function fmt(iso?: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  const tooltip = $derived(
    status === 'success' ? `Success · ${fmt(date)}`
    : status === 'failure' ? `Failed · ${fmt(date)}`
    : status === 'other'  ? `Skipped · ${fmt(date)}`
    : ''
  );
</script>

<span title={tooltip} style="display:contents;">
  {#if status === 'success'}
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <polyline points="1.5,5.5 4,8 8.5,2" stroke="#22c55e" stroke-width="1.75"
        stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  {:else if status === 'failure'}
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M2,2 L8,8 M8,2 L2,8" stroke="#ef4444" stroke-width="1.75" stroke-linecap="round" />
    </svg>
  {:else if status === 'other'}
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <circle cx="5" cy="5" r="3.5" stroke="#52525b" stroke-width="1.5" />
    </svg>
  {:else}
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <circle cx="5" cy="5" r="3.5" fill="#27272a" />
    </svg>
  {/if}
</span>
