<script lang="ts">


  let paneWidth = $state(0)
  let lastHovered : {row: number, col: number} = $state({row: 0, col: 0})
  let perfboardSelected : boolean[][] = $derived.by(() => {
    let numRows = 10
    let numCols = Math.floor(paneWidth / 17) || 1
    let holes = Array.from(Array(numRows), () => new Array(numCols).fill(false))
    for (let row = 0; row <= lastHovered.row; row++) {
      for (let col = 0; col <= lastHovered.col; col++) {
        holes[row][col] = true
      }
    }
    return holes
  })

</script>
<div class="w-[60vw] h-[80vh] rounded-lg shadow-lg  p-4 flex items-center justify-center"
  bind:clientWidth={paneWidth}
>
    <svg width={paneWidth} height="200" viewBox="0 0 {paneWidth} 200">
      <!-- PCB Background -->
      <rect width={paneWidth} height="200" fill="#152347" />
      
      {#each perfboardSelected as row, rowI}
        {#each row as col, colI}
        <rect 
            x={8 + colI * 16}
            y={8 + rowI * 16}
            width="24"
            height="24"
            fill="transparent"
            role="button"
            tabindex="0"
            onmouseenter={() => lastHovered = {row: rowI, col: colI}}
          />
          <!-- Copper pad -->
          <circle 
            cx={20 + colI * 16} 
            cy={20 + rowI * 16} 
            r="6" 
            fill={col ? "#CD7F32" : "gray"}
          />
          <!-- Drill hole -->
          <circle 
            cx={20 + colI * 16} 
            cy={20 + rowI * 16} 
            r="2" 
            fill="#1a1a1a"
          />
        {/each}
      {/each}
    </svg>
</div>
