<script lang="ts">
  import { onMount } from 'svelte';
  import * as echarts from 'echarts/core';
  import { LineChart } from 'echarts/charts';
  import { GridComponent } from 'echarts/components';
  import { SVGRenderer } from 'echarts/renderers';

  echarts.use([LineChart, GridComponent, SVGRenderer]);

  let {
    data,
    color = '#818cf8',
    width = 140,
    height = 36
  }: {
    data: number[];
    color?: string;
    width?: number;
    height?: number;
  } = $props();

  let el: HTMLDivElement;
  let chart: ReturnType<typeof echarts.init> | null = null;

  function option(values: number[]) {
    return {
      animation: false,
      grid: { left: 0, right: 0, top: 3, bottom: 3 },
      xAxis: { type: 'category', show: false, boundaryGap: false },
      yAxis: { show: false, scale: true },
      series: [
        {
          type: 'line',
          data: values,
          smooth: 0.4,
          showSymbol: false,
          lineStyle: { color, width: 1.5 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: color + '50' },
                { offset: 1, color: color + '00' }
              ]
            }
          }
        }
      ]
    };
  }

  onMount(() => {
    chart = echarts.init(el, null, { renderer: 'svg', width, height });
    chart.setOption(option(data));
    return () => chart?.dispose();
  });

  $effect(() => {
    if (chart) chart.setOption(option(data));
  });
</script>

<div bind:this={el} style="width:{width}px;height:{height}px;display:block;"></div>
