<script lang="ts">
  import type { ComponentBody } from "$lib/types";

  interface Props {
    componentBodies: ComponentBody[];
    onClearAllBodies: () => void;
    onRemoveBody: (index: number) => void;
  }

  const { 
    componentBodies,
    onClearAllBodies,
    onRemoveBody
  }: Props = $props();
</script>

<div class="h-full flex flex-col gap-2 min-h-0 flex-1">
  <div class="flex items-center justify-between mb-2">
    <span class="text-sm font-medium">Body</span>
    <button class="btn btn-xs btn-error btn-outline" onclick={onClearAllBodies}>Clear</button>
  </div>
  <div class="bg-base-100 rounded p-2 flex-1 min-h-0 overflow-y-auto">
    {#if componentBodies && componentBodies.length > 0}
      <div class="space-y-1">
        {#each componentBodies as body, i}
          <div class="flex items-center gap-2 p-2 hover:bg-base-200 rounded">
            <span class="badge badge-secondary badge-sm">{i + 1}</span>
            <span class="text-xs bg-base-200 px-2 py-1 rounded font-mono">{body.x}·{body.y}</span>
            <span class="text-xs bg-accent/20 px-2 py-1 rounded font-mono">{body.width}×{body.height}</span>
            <div class="flex-1"></div>
            <button 
              class="btn btn-xs btn-error btn-outline" 
              onclick={() => onRemoveBody(i)}
            >
              ×
            </button>
          </div>
        {/each}
      </div>
    {:else}
      <div class="text-base-content/50 text-center py-4 text-xs">
        Shift + drag on board to set body
      </div>
    {/if}
  </div>
</div>
