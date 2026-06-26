<script lang="ts">
    import { onMount } from "svelte";
    import { base } from "$app/paths";
    import type { Dataset, DatasetMeta, RunResult } from "$lib/types";
    import {
        fetchDatasets,
        fetchMeta,
        fetchRuns,
        fetchRepoStats,
        type RepoStats,
    } from "$lib/github";
    import { timeAgo, splitName, seededSparkline } from "$lib/utils";
    import Sparkline from "$lib/components/Sparkline.svelte";
    import RunDot from "$lib/components/RunDot.svelte";

    let datasets = $state<Dataset[]>([]);
    let meta = $state<Record<string, DatasetMeta>>({});
    let runs = $state<Record<string, RunResult[]>>({});
    let repoStats = $state<Record<string, RepoStats>>({});
    let firstVintages = $state<Record<string, string>>({});
    let fromStaticFile = $state(false);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let query = $state("");

    let filtered = $derived(
        query.trim()
            ? datasets.filter(
                  (d) =>
                      d.name.toLowerCase().includes(query.toLowerCase()) ||
                      (meta[d.name]?.title ?? d.description ?? "")
                          .toLowerCase()
                          .includes(query.toLowerCase()),
              )
            : datasets,
    );

    onMount(async () => {
        // Try the pre-built static file first (produced by the pipeline in CI).
        try {
            const res = await fetch(`${base}/status.json`);
            if (res.ok) {
                const file = await res.json();
                datasets = file.datasets;
                for (const d of file.datasets) {
                    meta[d.name] = {
                        title: d.title,
                        frequency: d.frequency,
                        source_name: d.source_name,
                        source_url: d.source_url,
                    };
                    if (d.sparkline?.length)
                        repoStats[d.name] = {
                            sparkline: d.sparkline,
                            seriesCount: d.series_count,
                        };
                    if (d.runs?.length) runs[d.name] = d.runs;
                    if (d.first_vintage)
                        firstVintages[d.name] = d.first_vintage;
                }
                fromStaticFile = true;
                loading = false;
                return;
            }
        } catch {
            /* fall through to live API */
        }

        // Local dev fallback: live GitHub API calls.
        try {
            datasets = await fetchDatasets();
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load datasets";
        } finally {
            loading = false;
        }
    });

    // Live API enrichment — only fires when status.json was not available.
    $effect(() => {
        if (fromStaticFile || datasets.length === 0) return;
        for (const dataset of datasets) {
            fetchMeta(dataset.name).then((m) => {
                if (m) meta[dataset.name] = m;
            });
            fetchRuns(dataset.name).then((r) => {
                runs[dataset.name] = r;
            });
            fetchRepoStats(dataset.name).then((s) => {
                if (s) repoStats[dataset.name] = s;
            });
        }
    });

    const COLS = "180px 1fr 90px 52px 68px 140px 80px 80px";
    const GAP = "gap: 1rem;";
</script>

<div class="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
    <!-- Sticky header -->
    <header
        class="sticky top-0 z-20 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md"
    >
        <div
            class="max-w-5xl mx-auto px-6 h-13 flex items-center gap-2 text-sm"
        >
            <a
                href="https://opentsi.github.io"
                class="font-semibold tracking-tight text-zinc-200 hover:text-white transition-colors no-underline"
                >opentsi</a
            >
            <span class="text-zinc-700">/</span>
            <span class="text-zinc-500">status</span>
        </div>
    </header>

    <main class="max-w-5xl mx-auto px-6">
        <!-- Hero row -->
        <div
            class="py-10 flex items-end justify-between gap-6 border-b border-zinc-800/60"
        >
            <div>
                <h1
                    class="text-3xl font-semibold tracking-tight text-zinc-100 mb-1.5"
                >
                    Dataset Status
                </h1>
                <p class="text-sm text-zinc-500">
                    Community time series archives — version-controlled,
                    revision-tracked.
                </p>
            </div>
            <div class="shrink-0 text-right">
                {#if loading}
                    <div
                        class="h-8 w-16 bg-zinc-800 rounded animate-pulse"
                    ></div>
                {:else if !error}
                    <p class="text-3xl font-bold tabular-nums text-zinc-100">
                        {filtered.length}
                    </p>
                    <p class="text-xs text-zinc-600 mt-0.5">
                        {#if query}{filtered.length} of {datasets.length}{:else}{datasets.length}
                            total{/if}
                    </p>
                {/if}
            </div>
        </div>

        <!-- Search -->
        <div class="py-4">
            <div class="relative">
                <svg
                    class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                >
                    <circle cx="11" cy="11" r="8" /><path
                        d="m21 21-4.35-4.35"
                    />
                </svg>
                <input
                    bind:value={query}
                    type="search"
                    placeholder="Filter by name or description…"
                    class="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-zinc-200
                           placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600 focus:ring-1
                           focus:ring-zinc-600/50 transition-all"
                />
            </div>
        </div>

        <!-- Column headers -->
        <div
            class="grid items-center px-3 py-2 border-b border-zinc-800/60"
            style="grid-template-columns: {COLS}; {GAP}"
        >
            {#each ["Dataset", "Title", "First Vintage", "Series", "Freq", "Example Series", "Last Commit", "Runs"] as label}
                <span
                    class="text-xs font-medium text-zinc-600 uppercase tracking-wider whitespace-nowrap"
                >
                    {label}
                </span>
            {/each}
        </div>

        <!-- Dataset rows -->
        {#if loading}
            {#each Array(12) as _, i (i)}
                <div
                    class="grid items-center px-3 py-4 border-b border-zinc-800/30 animate-pulse"
                    style="grid-template-columns: {COLS}; {GAP}"
                >
                    <div
                        class="h-3.5 rounded bg-zinc-800"
                        style="width:{70 + ((i * 13) % 25)}%"
                    ></div>
                    <div
                        class="h-2.5 rounded bg-zinc-900"
                        style="width:{50 + ((i * 17) % 40)}%"
                    ></div>
                    <div
                        class="h-2.5 rounded bg-zinc-900"
                        style="width:28px"
                    ></div>
                    <div
                        class="h-2.5 rounded bg-zinc-900"
                        style="width:44px"
                    ></div>
                    <div class="h-9 rounded bg-zinc-900/70"></div>
                    <div
                        class="h-2.5 rounded bg-zinc-900 ml-auto"
                        style="width:48px"
                    ></div>
                    <div
                        class="h-2.5 rounded bg-zinc-900 ml-auto"
                        style="width:48px"
                    ></div>
                    <div class="flex items-center gap-1.5">
                        {#each Array(5) as _}
                            <span
                                class="w-2.5 h-2.5 rounded-full bg-zinc-800 shrink-0"
                            ></span>
                        {/each}
                    </div>
                </div>
            {/each}
        {:else if error}
            <div class="py-24 text-center">
                <p class="text-zinc-600 text-sm">{error}</p>
            </div>
        {:else if filtered.length === 0}
            <div class="py-24 text-center space-y-1">
                <p class="text-zinc-500 text-sm">No datasets match</p>
                <p class="text-zinc-400 font-mono text-sm">"{query}"</p>
            </div>
        {:else}
            {#each filtered as dataset (dataset.name)}
                {@const [prefix, key] = splitName(dataset.name)}
                {@const spark = repoStats[dataset.name]?.sparkline.length
                    ? repoStats[dataset.name].sparkline
                    : seededSparkline(dataset.name)}
                {@const seriesCount = repoStats[dataset.name]?.seriesCount}
                {@const title =
                    meta[dataset.name]?.title || dataset.description}
                {@const frequency = meta[dataset.name]?.frequency}
                <div
                    class="grid items-center px-3 py-4 border-b border-zinc-800/30 rounded
                           hover:bg-zinc-900/40 transition-colors duration-100"
                    style="grid-template-columns: {COLS}; {GAP}"
                >
                    <!-- Dataset id -->
                    <div class="min-w-0">
                        <a
                            href={dataset.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="font-mono text-[13px] leading-none truncate block no-underline
                                   hover:text-white transition-colors"
                        >
                            <span class="text-zinc-600">{prefix}</span><span
                                class="text-zinc-200 font-medium">{key}</span
                            >
                        </a>
                    </div>

                    <!-- Title -->
                    <div class="min-w-0">
                        {#if title}
                            <a
                                href={dataset.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                {title}
                                class="text-xs text-zinc-500 leading-snug truncate block no-underline
                                       hover:text-zinc-300 transition-colors"
                            >
                                {title}
                            </a>
                        {:else}
                            <span class="text-xs text-zinc-800">—</span>
                        {/if}
                    </div>

                    <!-- First vintage -->
                    <div>
                        {#if firstVintages[dataset.name]}
                            <span class="text-xs text-zinc-600 tabular-nums"
                                >{firstVintages[dataset.name]}</span
                            >
                        {:else}
                            <span class="text-xs text-zinc-800">—</span>
                        {/if}
                    </div>

                    <!-- Series count -->
                    <div>
                        {#if seriesCount != null}
                            <span class="text-xs text-zinc-500 tabular-nums"
                                >{seriesCount}</span
                            >
                        {:else}
                            <span class="text-xs text-zinc-700">—</span>
                        {/if}
                    </div>

                    <!-- Frequency -->
                    <div>
                        {#if frequency}
                            <span class="text-xs text-zinc-500"
                                >{frequency}</span
                            >
                        {:else}
                            <span class="text-xs text-zinc-700">—</span>
                        {/if}
                    </div>

                    <!-- Sparkline -->
                    <div class="overflow-hidden">
                        <Sparkline data={spark} width={140} height={36} />
                    </div>

                    <!-- Last commit -->
                    <div class="text-right">
                        <span class="text-xs text-zinc-600 tabular-nums">
                            {timeAgo(dataset.pushed_at)}
                        </span>
                    </div>

                    <!-- Last 5 GHA runs — newest left, oldest right -->
                    <div class="flex items-center gap-1.5">
                        {#each runs[dataset.name] ?? [] as run}
                            <RunDot status={run.status} date={run.date} />
                        {/each}
                        {#each Array(5 - (runs[dataset.name]?.length ?? 0)) as _}
                            <RunDot status={null} />
                        {/each}
                    </div>
                </div>
            {/each}
        {/if}

        <!-- Footer -->
        <div class="py-10 text-center">
            <p class="text-xs text-zinc-800">
                <a
                    href="https://github.com/opentsi"
                    target="_blank"
                    rel="noopener"
                    class="hover:text-zinc-600 transition-colors"
                    >github.com/opentsi</a
                >
            </p>
        </div>
    </main>
</div>
