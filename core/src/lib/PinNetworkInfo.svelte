<script lang="ts">
  import type { PinPosition } from "xtoedif";

  interface NetworkInfo {
    netName: string;
    netCode: number;
    connectedComponents: Array<{
      ref: string;
      name: string;
      pinNumber: string | number;
      pinFunction?: string;
    }>;
  }

  interface PinInfo {
    partKey?: string;
    pinNumber: string | number;
    name?: string;
    pinFunction?: string;
  }

  interface Props {
    displayPin: PinInfo | null;
    networkInfo: NetworkInfo | null;
    isHighlighted: boolean;
    pinnedPlaced: PinPosition | undefined;
    selectedPins: PinPosition[];
    onRemovePin: () => void;
    onClearHighlight: () => void;
  }

  const { 
    displayPin,
    networkInfo,
    isHighlighted,
    pinnedPlaced,
    selectedPins,
    onRemovePin,
    onClearHighlight
  }: Props = $props();
</script>

{#if displayPin}
  <div class="{isHighlighted ? 'bg-info/10 border-info/30' : 'bg-primary/10 border-primary/30'} border rounded-lg p-3 shrink-0">
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 {isHighlighted ? 'text-info' : 'text-primary'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
        </svg>
        <span class="text-sm font-medium {isHighlighted ? 'text-info' : 'text-primary'}">
          {isHighlighted ? 'Selected' : 'Next to place'}: Pin {displayPin.pinNumber} - {displayPin.name || displayPin.pinFunction || `Pin${displayPin.pinNumber}`}
        </span>
        {#if networkInfo}
          <span class="badge {isHighlighted ? 'badge-info' : 'badge-primary'} badge-xs">Net: {networkInfo.netName}</span>
        {/if}
        {#if pinnedPlaced}
          <span class="badge badge-success badge-xs">Placed at {pinnedPlaced.x}·{pinnedPlaced.y}</span>
        {:else}
          <span class="badge badge-warning badge-xs">Not placed</span>
        {/if}
      </div>
      <div class="flex gap-1">
        {#if isHighlighted && pinnedPlaced}
          <button 
            class="btn btn-xs btn-error btn-outline"
            onclick={onRemovePin}
            title="Remove pin placement"
          >
            Remove Pin
          </button>
        {/if}
        {#if isHighlighted}
          <button 
            class="btn btn-xs btn-ghost"
            onclick={onClearHighlight}
            title="Close pin info"
          >
            ×
          </button>
        {/if}
      </div>
    </div>
    
    {#if networkInfo && networkInfo.connectedComponents.length > 0}
      <div class="text-xs text-base-content/70">
        <span class="font-medium">Will connect to:</span>
        <div class="mt-1 space-y-1">
          {#each networkInfo.connectedComponents as component}
            <div class="bg-base-100/50 rounded px-2 py-1">
              <span class="text-primary font-medium">{component.name}</span>
              <span class="text-base-content/50">({component.ref})</span>
              <span class="badge badge-outline badge-xs ml-1">Pin {component.pinNumber}</span>
              {#if component.pinFunction}
                <span class="text-base-content/40 ml-1">- {component.pinFunction}</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {:else if networkInfo}
      <div class="text-xs text-base-content/50">This pin has no connections in the circuit</div>
    {:else}
      <div class="text-xs text-base-content/50">Pin name: {displayPin.name || displayPin.pinFunction || `Pin${displayPin.pinNumber}`}</div>
    {/if}
  </div>
{/if}
