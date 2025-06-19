<script lang="ts">
  interface Props {
    "numRows" : number,
    "numCols" : number,
    
  }
  let props: Props = $props()

  const PAD_SPACING = 8
  const SIDE_PADDING = 20
  const PAD_RADIUS = 12

  const padDimension = (PAD_RADIUS*2 + PAD_SPACING)
  
  let idealWidth = $derived(SIDE_PADDING * 2 + props.numCols * padDimension)
  let idealHeight = $derived(SIDE_PADDING * 2 + props.numRows * padDimension)
  
  let maxWidth = $derived(typeof window !== 'undefined' ? window.innerWidth * 0.6 : 800)
  let maxHeight = $derived(typeof window !== 'undefined' ? window.innerHeight * 0.6 : 600)
  
  // if either width > maxWidth or height > maxHeight, we nee to scale appropriately so that the actual width/height is maxwidth/maxheight (depending on which is crossing the limit, but everything should be scaled equally)
  let scale = $derived(Math.min(1, maxWidth / idealWidth, maxHeight / idealHeight))
  
  let svgWidth = $derived(idealWidth * scale)
  let svgHeight = $derived(idealHeight * scale)
  let scaledPadding = $derived(SIDE_PADDING * scale)
  let scaledSpacing = $derived(padDimension * scale)
  let scaledPadRadius = $derived(PAD_RADIUS * scale)
  let scaledHoleRadius = $derived(PAD_RADIUS * scale * 0.6)
</script>

<svg 
  width={svgWidth} 
  height={svgHeight} 
  viewBox="0 0 {svgWidth} {svgHeight}"
>
  <!-- PCB Background -->
  <rect width={svgWidth} height={svgHeight} fill="#152347" />
  
  {#each Array(props.numRows) as _, rowI}
    {#each Array(props.numCols) as _, colI}
      <!-- Copper pad -->
      <circle 
        cx={scaledPadding + colI * scaledSpacing + scaledSpacing * .5} 
        cy={scaledPadding + rowI * scaledSpacing + scaledSpacing * .5} 
        r={scaledPadRadius}
        fill="#CD7F32"
      />
      <!-- Drill hole -->
      <circle 
        cx={scaledPadding + colI * scaledSpacing + scaledSpacing * .5} 
        cy={scaledPadding + rowI * scaledSpacing + scaledSpacing * .5} 
        r={scaledHoleRadius}
        fill="#1a1a1a"
      />
    {/each}
  {/each}
</svg>
