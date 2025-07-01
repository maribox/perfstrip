<script lang="ts">
  import type { PinPosition } from "xtoedif";
  import type { PartPin } from "$lib/types";

  interface Props {
    currentPartPins: PartPin[];
    selectedPins: PinPosition[];
    allPinsPlaced: boolean;
    nextPinToPlace: any | null;
    footprintEditQueuePartKey: string;
    parts: Record<string, any>;
    parsedKiCadDoc: any;
    getNetworkForPin: (partKey: string, pinNumber: string | number) => any;
    onClearAllPins: () => void;
    onUpdatePinName: (index: number, newName: string) => void;
    onRemovePin: (index: number) => void;
    onSetHighlightedPin: (pin: { partKey: string; pinNumber: string | number } | null) => void;
  }

  const { 
    currentPartPins,
    selectedPins,
    allPinsPlaced,
    nextPinToPlace,
    footprintEditQueuePartKey,
    parts,
    parsedKiCadDoc,
    getNetworkForPin,
    onClearAllPins,
    onUpdatePinName,
    onRemovePin,
    onSetHighlightedPin
  }: Props = $props();

  let scrollContainer: HTMLElement;

  // Auto-scroll to next pin
  $effect(() => {
    if (nextPinToPlace && scrollContainer) {
      const nextPinElement = scrollContainer.querySelector(`[data-pin="${nextPinToPlace.pinNumber}"]`);
      if (nextPinElement) {
        nextPinElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });
</script>

<div class="flex-7">
  <div class="flex items-center justify-between mb-2">
    <div class="flex items-center gap-2">
      <span class="text-sm font-medium">Pins ({selectedPins.length}/{currentPartPins.length})</span>
      {#if !allPinsPlaced}
        <span class="badge badge-warning badge-xs">Incomplete</span>
         <div class="text-xs text-base-content/60 p-1 bg-base-200/50 rounded">
        💡 Click to place single pins, or drag to place multiple pins
        </div>
      {:else}
        <span class="badge badge-success badge-xs">Complete</span>
      {/if}
    </div>
    <div class="flex gap-1">
      <button class="btn btn-xs btn-error btn-outline" onclick={onClearAllPins}>Clear All</button>
    </div>
  </div>
  <div class="bg-base-100 rounded p-2 h-32 overflow-y-auto border" bind:this={scrollContainer}>
    {#if currentPartPins.length === 0}
      <div class="text-base-content/50 text-center py-4 text-xs">
        No pins defined for this part
      </div>
    {:else}
     
      <div class="space-y-1">
        {#each currentPartPins as partPin}
          {@const placedPin = selectedPins.find(sp => sp.pinNumber == partPin.pinNumber)}
          {@const networkInfo = getNetworkForPin(footprintEditQueuePartKey, partPin.pinNumber)}
          {@const isNextPin = nextPinToPlace?.pinNumber === partPin.pinNumber}
          <div 
            class="flex items-center gap-2 p-1 rounded {partPin.isPlaced ? 'bg-primary/10' : isNextPin ? 'bg-warning/20 border border-warning' : 'bg-base-200/50'}"
            data-pin={partPin.pinNumber}
          >
            <span class="badge badge-sm font-bold {partPin.isPlaced ? 'badge-primary' : 'badge-outline'}">{partPin.pinNumber}</span>
            {#if partPin.isPlaced && placedPin}
              <span class="text-xs bg-base-200 px-2 py-1 rounded font-mono">{placedPin.x}·{placedPin.y}</span>
              <input 
                type="text" 
                value={placedPin.name || partPin.name}
                onchange={(e) => {
                  const index = selectedPins.findIndex(sp => sp.pinNumber == partPin.pinNumber);
                  if (index >= 0) onUpdatePinName(index, (e.target as HTMLInputElement)?.value || '');
                }}
                class="input input-xs w-20 bg-transparent border-0 focus:bg-base-200"
                placeholder="Name"
                onfocus={() => {
                  onSetHighlightedPin({ partKey: footprintEditQueuePartKey, pinNumber: partPin.pinNumber });
                }}
                onblur={() => {
                  onSetHighlightedPin(null);
                }}
                onmouseover={() => {
                  onSetHighlightedPin({ partKey: footprintEditQueuePartKey, pinNumber: partPin.pinNumber });
                }}
                onmouseleave={() => {
                  onSetHighlightedPin(null);
                }}
              />
              <div class="flex-1 min-w-0">
                {#if networkInfo}
                  <div class="text-xs text-success truncate font-medium">
                    {networkInfo.netName}
                  </div>
                  {#if networkInfo.connectedComponents.length > 0}
                    <div class="text-xs text-base-content/50 truncate">
                      ({networkInfo.connectedComponents.map((c: any) => c.name).join(', ')})
                    </div>
                  {/if}
                {/if}
              </div>
              <button 
                class="btn btn-xs btn-error btn-outline"
                onclick={() => {
                  const index = selectedPins.findIndex(sp => sp.pinNumber == partPin.pinNumber);
                  if (index >= 0) onRemovePin(index);
                }}
                aria-label="Remove pin {partPin.pinNumber}"
              >
                ×
              </button>
            {:else}
              <div class="flex-1 min-w-0">
                <div class="text-xs text-base-content/60 truncate">{partPin.name}</div>
                {#if networkInfo}
                  <div class="text-xs text-base-content/50 truncate font-medium">
                    {networkInfo.netName}
                  </div>
                  {#if networkInfo.connectedComponents.length > 0}
                    <div class="text-xs text-base-content/40 truncate">
                      ({networkInfo.connectedComponents.map((c: any) => c.name).join(', ')})
                    </div>
                  {/if}
                {/if}
              </div>
              <button class="text-xs badge badge-outline badge-xs cursor-pointer"
                tabindex="0"
                onmouseover={() => {
                  onSetHighlightedPin({ partKey: footprintEditQueuePartKey, pinNumber: partPin.pinNumber });
                }}
                onmouseleave={() => {
                  onSetHighlightedPin(null);
                }}
                onfocus={() => {
                  onSetHighlightedPin({ partKey: footprintEditQueuePartKey, pinNumber: partPin.pinNumber });
                }}
                onblur={() => {
                  onSetHighlightedPin(null);
                }}
                onclick={() => {
                  onSetHighlightedPin({ partKey: footprintEditQueuePartKey, pinNumber: partPin.pinNumber });
                }}
              >Not placed</button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
