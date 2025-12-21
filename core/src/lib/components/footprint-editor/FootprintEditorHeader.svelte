<script lang="ts">
  interface Props {
    perfboardCols: number;
    perfboardRows: number;
    allPinsPlaced: boolean;
    currentFootprintType: "fixed" | "variable";
    onCancel: () => void;
    onFinish: () => void;
  }

  let { 
    perfboardCols = $bindable(),
    perfboardRows = $bindable(),
    allPinsPlaced,
    currentFootprintType,
    onCancel,
    onFinish
  }: Props = $props();
</script>

<div class="flex items-center justify-between bg-base-200/80 px-4 py-3 rounded-xl shrink-0 border border-base-300">
  <div class="flex items-center gap-4">
    <div class="text-sm font-medium">Footprint Editor</div>
    <div class="text-xs text-base-content/70">
      Board {perfboardCols} × {perfboardRows}
    </div>
    <div class="text-xs text-base-content/50">
      Use + around the board to grow size
    </div>
  </div>
  
  <div class="flex gap-2">
    <button class="btn btn-ghost btn-sm" onclick={onCancel}>
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
