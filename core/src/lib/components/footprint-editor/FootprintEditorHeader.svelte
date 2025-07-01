<script lang="ts">
  interface Props {
    perfboardCols: number;
    perfboardRows: number;
    allPinsPlaced: boolean;
    currentFootprintType: "fixed" | "variable";
    onCancel: () => void;
    onFinish: () => void;
    onColsChange: (cols: number) => void;
    onRowsChange: (rows: number) => void;
  }

  let { 
    perfboardCols = $bindable(),
    perfboardRows = $bindable(),
    allPinsPlaced,
    currentFootprintType,
    onCancel,
    onFinish,
    onColsChange,
    onRowsChange
  }: Props = $props();
</script>

<div class="flex items-center justify-between bg-base-200 p-3 rounded-lg shrink-0">
  <div class="flex items-center gap-4">
    <span class="text-sm font-medium">Board Size:</span>
    <div class="flex items-center gap-2">
      <input 
        type="number" 
        bind:value={perfboardCols} 
        min="5" 
        max="30" 
        class="input input-bordered w-20 text-center"
        placeholder="Width"
        onchange={() => onColsChange?.(perfboardCols)}
      />
      <span class="text-sm">×</span>
      <input 
        type="number" 
        bind:value={perfboardRows} 
        min="5" 
        max="30" 
        class="input input-bordered w-20 text-center"
        placeholder="Height"
        onchange={() => onRowsChange?.(perfboardRows)}
      />
    </div>
  </div>
  
  <div class="flex gap-2">
    <button class="btn btn-secondary btn-sm" onclick={onCancel}>
      Cancel
    </button>
    <button 
      class="btn btn-primary btn-sm" 
      onclick={onFinish}
      disabled={currentFootprintType === "fixed" && !allPinsPlaced}
    >
      OK
    </button>
  </div>
</div>
