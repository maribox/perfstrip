<script lang="ts">
  interface Props {
    numRows: number;
    numCols: number;
    scaledPadding: number;
    scaledSpacing: number;
    scaledPadRadius: number;
    svgWidth: number;
    svgHeight: number;
  }

  let props: Props = $props();
  let fontSize = $derived(Math.max(8, props.scaledPadRadius * 0.6));
</script>

<g
  style="pointer-events: none"
  fill="#9ca3af"
  font-size={fontSize}
  font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
>
  {#each Array(props.numCols) as _, colI}
    <text
      x={props.scaledPadding + colI * props.scaledSpacing + props.scaledSpacing * 0.5}
      y={props.scaledPadding * 0.55}
      text-anchor="middle"
      dominant-baseline="middle"
    >
      {colI + 1}
    </text>
  {/each}
  {#each Array(props.numRows) as _, rowI}
    <text
      x={props.scaledPadding * 0.55}
      y={props.scaledPadding + rowI * props.scaledSpacing + props.scaledSpacing * 0.5}
      text-anchor="middle"
      dominant-baseline="middle"
    >
      {rowI + 1}
    </text>
  {/each}
  {#each Array(props.numCols) as _, colI}
    <text
      x={props.scaledPadding + colI * props.scaledSpacing + props.scaledSpacing * 0.5}
      y={props.svgHeight - props.scaledPadding * 0.55}
      text-anchor="middle"
      dominant-baseline="middle"
    >
      {colI + 1}
    </text>
  {/each}
  {#each Array(props.numRows) as _, rowI}
    <text
      x={props.svgWidth - props.scaledPadding * 0.55}
      y={props.scaledPadding + rowI * props.scaledSpacing + props.scaledSpacing * 0.5}
      text-anchor="middle"
      dominant-baseline="middle"
    >
      {rowI + 1}
    </text>
  {/each}
</g>
