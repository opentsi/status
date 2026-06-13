<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<svelte:head>
  <title>OpenTSI Status</title>
  <meta name="description" content="Live status of all opentsi community data archives." />
</svelte:head>

{@render children()}
