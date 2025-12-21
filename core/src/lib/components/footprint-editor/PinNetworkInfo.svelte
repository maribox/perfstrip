<script lang="ts">
  import type { PinPosition } from "xtoedif";
  import type { NetworkInfo, PinInfo } from "$lib/types";

  interface Props {
    displayPin: PinInfo | null;
    networkInfo: NetworkInfo | null;
    isHighlighted: boolean;
    pinnedPlaced: PinPosition | undefined;
    onRemovePin: () => void;
    onClearHighlight: () => void;
    onSkipPin: () => void;
  }

  const { 
    displayPin,
    networkInfo,
    isHighlighted,
    pinnedPlaced,
    onRemovePin,
    onClearHighlight,
    onSkipPin
  }: Props = $props();
</script>

{#if displayPin}
  <div class="{isHighlighted ? 'bg-info/10 border-info/30' : 'bg-base-200/70 border-base-300'} border rounded-lg p-3 shrink-0">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="text-xs uppercase tracking-wide text-base-content/50">Pin</div>
        <div class="text-sm font-semibold truncate">
          {`#${displayPin.pinNumber}`} · {displayPin.name || displayPin.pinFunction || "Unnamed"}
        </div>
      </div>
      <div class="flex gap-2">
        {#if !pinnedPlaced}
          <button class="btn btn-xs btn-ghost" onclick={onSkipPin}>
            Skip
          </button>
        {/if}
        {#if isHighlighted && pinnedPlaced}
          <button 
            class="btn btn-xs btn-error btn-outline"
            onclick={onRemovePin}
            title="Remove pin placement"
          >
            Remove
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

    {#if networkInfo && networkInfo.netName !== "No net"}
      <div class="mt-2 text-xs text-base-content/70">
        <div class="flex items-center gap-2">
          <span class="text-base-content/50">Net</span>
          <span class="badge badge-outline badge-xs">{networkInfo.netName}</span>
        </div>
        {#if networkInfo.connectedComponents.length > 0}
          {@const uniqueConnections = Array.from(new Map(networkInfo.connectedComponents.map(component => [
            `${component.ref}-${component.pinNumber}`,
            component
          ])).values())}
          <div class="mt-2 flex flex-wrap gap-2">
            {#each uniqueConnections as component}
              <div
                class="flex items-center gap-2 rounded-full bg-base-100/60 border border-base-300 px-2 py-1"
                title={component.name + " (" + component.ref + ") pin " + component.pinNumber}
              >
                <span class="w-2 h-2 rounded-full bg-primary"></span>
                <span class="text-[11px] font-medium">{component.ref}·{component.pinNumber}</span>
              </div>
            {/each}
          </div>
        {:else}
          <div class="text-base-content/50">No connections</div>
        {/if}
      </div>
    {/if}
  </div>
{/if}
