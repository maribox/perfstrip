<script lang="ts">
  import type { PinPosition } from "xtoedif";
  import type { NetworkInfo, PartPin } from "$lib/types";
  import IconIconParkOutlineResistor from "~icons/icon-park-outline/resistor";
  import IconIconoirElectronicsTransistor from "~icons/iconoir/electronics-transistor";
  import IconFluentDeveloperBoard16Regular from "~icons/fluent/developer-board-16-regular";
  import IconIconParkOutlineFileQuestion from "~icons/icon-park-outline/file-question";
  type PinRow = PartPin & { isPlaced: boolean; isSkipped?: boolean; pinFunction?: string };
  type ConnectedComponent = NetworkInfo["connectedComponents"][number];
  interface Props {
    currentPartPins: PinRow[];
    selectedPins: PinPosition[];
    allPinsPlaced: boolean;
    nextPinToPlace: any | null;
    footprintEditQueuePartKey: string;
    getNetworkForPin: (partKey: string, pinNumber: string | number) => NetworkInfo | null;
    onClearAllPins: () => void;
    onUpdatePinName: (index: number, newName: string) => void;
    onRemovePin: (index: number) => void;
    onSetHighlightedPin: (pin: { partKey: string; pinNumber: string | number } | null) => void;
    onSelectPinToPlace: (pinNumber: string | number) => void;
    onSkipNextPin: () => void;
    onSkipNextConnectedPin: () => void;
    hideDisconnectedPins: boolean;
    onToggleHideDisconnected: () => void;
    groupConnectedPins: boolean;
    onToggleGroupConnected: () => void;
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
    groupConnectedPins,
    onToggleGroupConnected,
    highlightedPinNumber
  }: Props = $props();
  let scrollContainer: HTMLElement;
  let networkByPin = $derived.by(() => {
    const map = new Map<string | number, NetworkInfo | null>();
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
  let activePinNumber = $derived(highlightedPinNumber ?? nextPinToPlace?.pinNumber ?? null);
  let pinGroups = $derived.by(() => {
    if (!groupConnectedPins) {
      return [{ key: "all", pins: displayedPins, isActiveGroup: false }];
    }
    const groups = new Map<string, PinRow[]>();
    const order: string[] = [];
    let activeKey: string | null = null;
    displayedPins.forEach((pin) => {
      const networkInfo = networkByPin.get(pin.pinNumber);
      const hasNet = networkInfo && networkInfo.netName !== "No net";
      const key = hasNet ? `net:${networkInfo.netCode ?? networkInfo.netName}` : `pin:${pin.pinNumber}`;
      if (!groups.has(key)) {
        groups.set(key, []);
        order.push(key);
      }
      groups.get(key)?.push(pin);
      if (activePinNumber != null && pin.pinNumber == activePinNumber) {
        activeKey = key;
      }
    });
    return order.map((key) => {
      const pins = groups.get(key) ?? [];
      if (activePinNumber == null) {
        return { key, pins, isActiveGroup: key === activeKey };
      }
      const activeIndex = pins.findIndex((pin) => pin.pinNumber == activePinNumber);
      if (activeIndex <= 0) {
        return { key, pins, isActiveGroup: key === activeKey };
      }
      const orderedPins = [pins[activeIndex], ...pins.slice(0, activeIndex), ...pins.slice(activeIndex + 1)];
      return { key, pins: orderedPins, isActiveGroup: key === activeKey };
    });
  });
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
  const resolvePinLabel = (pin: PinRow) => {
    const pinFunction = pin.pinFunction?.trim();
    const pinName = pin.name?.trim();
    const isNumberedName = pinName ? /^pin\s*\d+$/i.test(pinName) : false;
    const primary = pinFunction || pinName || `Pin ${pin.pinNumber}`;
    const secondary = pinFunction && pinName && pinName !== pinFunction && !isNumberedName ? pinName : null;
    return { primary, secondary };
  };
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
        class="btn btn-sm btn-outline rounded-full {groupConnectedPins ? 'btn-primary' : ''}"
        onclick={onToggleGroupConnected}
      >
        {groupConnectedPins ? 'Grouping connected' : 'Not grouping connected'}
      </button>
      <button
        class="btn btn-sm btn-outline rounded-full {hideDisconnectedPins ? 'btn-primary' : ''}"
        onclick={onToggleHideDisconnected}
      >
        {hideDisconnectedPins ? "Hiding disconnected" : "Showing disconnected"}
      </button>
      <button class="btn btn-sm btn-error rounded-full" onclick={onClearAllPins}>Clear</button>
    </div>
  </div>
  <div class="bg-base-100 rounded p-2 flex-1 min-h-0 overflow-y-auto" bind:this={scrollContainer}>
    {#if currentPartPins.length === 0}
      <div class="text-base-content/50 text-center py-4 text-xs">
        No pins defined for this part
      </div>
    {:else}
      <div class="space-y-2">
        {#each pinGroups as group (group.key)}
          <div class="relative rounded-xl {groupConnectedPins && group.pins.length > 1 ? 'bg-primary/5 border border-primary/20 px-2 py-2' : ''} {groupConnectedPins && group.isActiveGroup ? 'bg-primary/10 border-primary/40' : ''}">
            {#if groupConnectedPins && group.pins.length > 1}
              <div class="absolute left-2 top-2 bottom-2 w-1 rounded-full {group.isActiveGroup ? 'bg-primary/60' : 'bg-primary/30'} pointer-events-none"></div>
            {/if}
            <div class="relative space-y-1 {groupConnectedPins && group.pins.length > 1 ? 'pl-2' : ''}">
              {#each group.pins as partPin}
                {@const placedPin = selectedPins.find(sp => sp.pinNumber == partPin.pinNumber)}
                {@const networkInfo = networkByPin.get(partPin.pinNumber)}
                {@const isActive = activePinNumber === partPin.pinNumber}
                {@const connectionCount = networkInfo?.connectedComponents?.length ?? 0}
                {@const pinLabel = resolvePinLabel(partPin)}
                {@const uniqueConnections = networkInfo?.connectedComponents
                  ? Array.from(new Map<string, ConnectedComponent>(networkInfo.connectedComponents.filter((component) => !groupConnectedPins || component.ref !== footprintEditQueuePartKey).map((component) => [`${component.ref}-${component.pinNumber}`, component] as const)).values())
                  : []}
                <div 
                  class="group flex items-center gap-3 p-2 rounded-md select-none cursor-pointer {partPin.isPlaced ? 'bg-primary/10' : 'bg-base-200/50'} {isActive ? 'bg-primary/15 scale-[1.01]' : ''}"
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
                          value={placedPin.name || partPin.pinFunction || partPin.name}
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
                            {pinLabel.primary}
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
                        {#if pinLabel.secondary}
                          <div class="text-[11px] text-base-content/50 truncate">{pinLabel.secondary}</div>
                        {/if}
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
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
