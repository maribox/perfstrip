<script lang="ts">
  import type { PinPosition } from "xtoedif";
  import type { PartPin } from "$lib/types";
  import IconIconParkOutlineResistor from "~icons/icon-park-outline/resistor";
  import IconIconoirElectronicsTransistor from "~icons/iconoir/electronics-transistor";
  import IconFluentDeveloperBoard16Regular from "~icons/fluent/developer-board-16-regular";
  import IconIconParkOutlineFileQuestion from "~icons/icon-park-outline/file-question";

  type PinRow = PartPin & { isPlaced: boolean; isSkipped?: boolean };

  interface Props {
    currentPartPins: PinRow[];
    selectedPins: PinPosition[];
    allPinsPlaced: boolean;
    nextPinToPlace: any | null;
    footprintEditQueuePartKey: string;
    getNetworkForPin: (partKey: string, pinNumber: string | number) => any;
    onClearAllPins: () => void;
    onUpdatePinName: (index: number, newName: string) => void;
    onRemovePin: (index: number) => void;
    onSetHighlightedPin: (pin: { partKey: string; pinNumber: string | number } | null) => void;
    onSelectPinToPlace: (pinNumber: string | number) => void;
    onSkipNextPin: () => void;
    onSkipNextConnectedPin: () => void;
    hideDisconnectedPins: boolean;
    onToggleHideDisconnected: () => void;
    highlightedPinNumber?: string | number | null;
  }

  const { 
    currentPartPins,
    selectedPins,
    allPinsPlaced,
    nextPinToPlace,
    footprintEditQueuePartKey,
    getNetworkForPin,
    onClearAllPins,
    onUpdatePinName,
    onRemovePin,
    onSetHighlightedPin,
    onSelectPinToPlace,
    onSkipNextPin,
    onSkipNextConnectedPin,
    hideDisconnectedPins,
    onToggleHideDisconnected,
    highlightedPinNumber
  }: Props = $props();

  let scrollContainer: HTMLElement;
  let networkByPin = $derived.by(() => {
    const map = new Map<string | number, any>();
    currentPartPins.forEach((pin) => {
      map.set(pin.pinNumber, getNetworkForPin(footprintEditQueuePartKey, pin.pinNumber));
    });
    return map;
  });
  let displayedPins = $derived.by(() => {
    return currentPartPins.filter((pin) => {
      const networkInfo = networkByPin.get(pin.pinNumber);
      return !hideDisconnectedPins || (networkInfo && networkInfo.netName !== "No net");
    });
  });
  let placedCount = $derived(displayedPins.filter((pin) => pin.isPlaced).length);

  const activateRow = (partPin: PinRow) => {
    onSetHighlightedPin({ partKey: footprintEditQueuePartKey, pinNumber: partPin.pinNumber });
    if (!partPin.isPlaced) {
      onSelectPinToPlace(partPin.pinNumber);
    }
  };

  const handleRowKeydown = (event: KeyboardEvent, partPin: PinRow) => {
    if (event.currentTarget !== event.target) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activateRow(partPin);
    }
  };

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

  <div class="h-full flex flex-col gap-2 min-h-0 select-none">
  <div class="flex items-center justify-between gap-3 flex-wrap mb-2">
    <div class="flex items-center gap-2">
      <span class="text-sm font-medium">Pins</span>
      <span class="text-xs text-base-content/50">{placedCount}/{displayedPins.length}</span>
    </div>
    <div class="flex items-center gap-2">
      <button
        class="btn btn-xs btn-ghost"
        onclick={onToggleHideDisconnected}
      >
        {hideDisconnectedPins ? "Show disconnected" : "Hide disconnected"}
      </button>
      <button class="btn btn-xs btn-error btn-outline" onclick={onClearAllPins}>Clear</button>
    </div>
  </div>
  <div class="bg-base-100 rounded p-2 flex-1 min-h-0 overflow-y-auto" bind:this={scrollContainer}>
    {#if currentPartPins.length === 0}
      <div class="text-base-content/50 text-center py-4 text-xs">
        No pins defined for this part
      </div>
    {:else}
     
      <div class="space-y-1">
        {#each displayedPins as partPin}
          {@const placedPin = selectedPins.find(sp => sp.pinNumber == partPin.pinNumber)}
          {@const networkInfo = networkByPin.get(partPin.pinNumber)}
          {@const activePinNumber = highlightedPinNumber ?? nextPinToPlace?.pinNumber}
          {@const isActive = activePinNumber === partPin.pinNumber}
          {@const connectionCount = networkInfo?.connectedComponents?.length ?? 0}
          {@const uniqueConnections = networkInfo?.connectedComponents
            ? Array.from(new Map(networkInfo.connectedComponents.map(component => [
              `${component.ref}-${component.pinNumber}`,
              component
            ])).values())
            : []}
          <div 
            class="group flex items-center gap-3 p-2 rounded-lg select-none cursor-pointer {partPin.isPlaced ? 'bg-primary/10' : 'bg-base-200/50'} {isActive ? 'bg-primary/15 scale-[1.01]' : ''}"
            data-pin={partPin.pinNumber}
            role="button"
            tabindex="0"
            onclick={() => activateRow(partPin)}
            onkeydown={(event) => handleRowKeydown(event, partPin)}
          >
            <span class="text-xs font-semibold w-6 text-center text-base-content/70">{partPin.pinNumber}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                {#if partPin.isPlaced && placedPin}
                  <input 
                    type="text" 
                    value={placedPin.name || partPin.name}
                    onchange={(e) => {
                      const index = selectedPins.findIndex(sp => sp.pinNumber == partPin.pinNumber);
                      if (index >= 0) onUpdatePinName(index, (e.target as HTMLInputElement)?.value || '');
                    }}
                    class="input input-xs w-28 bg-transparent border-0 focus:bg-base-200 select-text"
                    placeholder="Label"
                    onclick={(event) => event.stopPropagation()}
                  />
                {/if}
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <div class="text-xs text-base-content/80 truncate font-medium">
                      {partPin.name || `Pin ${partPin.pinNumber}`}
                    </div>
                    {#if isActive && !partPin.isPlaced}
                      <div class="flex items-center gap-2">
                        {#if networkInfo && networkInfo.netName === "No net"}
                          <button
                            class="btn btn-sm btn-ghost"
                            onclick={(event) => {
                              event.stopPropagation();
                              onSkipNextConnectedPin();
                            }}
                          >
                            Skip to Connected
                          </button>
                        {/if}
                        <button
                          class="btn btn-sm btn-error px-4"
                          onclick={(event) => {
                            event.stopPropagation();
                            if (hideDisconnectedPins) {
                              onSkipNextConnectedPin();
                              return;
                            }
                            onSkipNextPin();
                          }}
                        >
                          Skip Pin
                        </button>
                      </div>
                    {/if}
                  </div>
                  <div class="text-xs text-base-content/60 truncate">
                    {#if networkInfo && networkInfo.netName !== "No net"}
                      <span class="text-[13px] font-semibold">{networkInfo.netName}</span>
                    {:else}
                      No net
                    {/if}
                    {#if connectionCount > 0}
                      <span class="text-base-content/40"> · {connectionCount} link{connectionCount === 1 ? "" : "s"}</span>
                    {/if}
                  </div>
                </div>
              </div>
              {#if isActive}
                {#if uniqueConnections.length > 0}
                  <div class="mt-2 flex flex-wrap gap-2">
                    {#each uniqueConnections as component}
                      <div
                        class="flex items-center gap-2 rounded-full bg-base-100/70 px-2 py-1"
                        title={component.name + " (" + component.ref + ") pin " + component.pinNumber}
                      >
                        <span class="w-4 h-4 rounded-full bg-base-200/80 text-base-content flex items-center justify-center">
                          {#if component.type === "Resistor"}
                            <IconIconParkOutlineResistor class="w-3 h-3" />
                          {:else if component.type === "Transistor"}
                            <IconIconoirElectronicsTransistor class="w-3 h-3" />
                          {:else if component.type === "Board"}
                            <IconFluentDeveloperBoard16Regular class="w-3 h-3" />
                          {:else if component.type}
                            <span class="text-[9px] font-semibold">{component.type[0]}</span>
                          {:else}
                            <IconIconParkOutlineFileQuestion class="w-3 h-3" />
                          {/if}
                        </span>
                        <span class="text-[11px] font-medium">{component.name}</span>
                        <span class="text-[10px] text-base-content/50">{component.pinFunction || `Pin ${component.pinNumber}`}</span>
                      </div>
                    {/each}
                  </div>
                {/if}
              {/if}
            </div>
            {#if partPin.isPlaced && placedPin}
              <button 
                class="btn btn-xs btn-ghost opacity-0 group-hover:opacity-100"
                onclick={(event) => {
                  event.stopPropagation();
                  const index = selectedPins.findIndex(sp => sp.pinNumber == partPin.pinNumber);
                  if (index >= 0) onRemovePin(index);
                }}
                aria-label="Remove pin {partPin.pinNumber}"
              >
                ×
              </button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
