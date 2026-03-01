<script lang="ts">
  import type { Part } from "xtoedif";
  import type {
    FootprintEditState,
    OnEditFootprintFunction,
    OnEditMultipleFootprintsFunction
  } from "$lib/types";

  const {
    parts,
    footprintEditState,
    onEditFootprint,
    onFinishCurrentFootprint,
    onCancelCurrentFootprint,
    onEditMultipleFootprints,
    onAddPart,
    onUploadSpice,
  }: {
    parts: Record<string, Part>;
    footprintEditState: FootprintEditState
    onEditFootprint: OnEditFootprintFunction;
    onFinishCurrentFootprint: () =>  void;
    onCancelCurrentFootprint: () =>  void;
    onEditMultipleFootprints: OnEditMultipleFootprintsFunction;
    onAddPart: () => void;
    onUploadSpice: (spiceContent: string) => void;
  } = $props();

  let fileInput: HTMLInputElement;

  function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) onUploadSpice(content);
      };
      reader.readAsText(file);
    }
    // Reset so the same file can be re-uploaded
    target.value = "";
  }

</script>

<div class="overflow-auto">
  <!-- Headers -->
  <div class="flex items-center gap-2 px-4 py-2 bg-base-300 sticky top-0">
    <div class="w-12 flex-shrink-0"></div>
    <!-- Avatar space -->
    <div class="flex-1 min-w-0 px-2 flex justify-center">
      <h3 class="font-semibold text-sm">Part</h3>
    </div>
    <div class="w-42 flex-shrink-0 pl-2">
      <div class="flex flex-col items-center gap-1">
        <h3 class="font-semibold text-sm">Footprint</h3>
        {#if parts}
          {@const invalidParts = Object.entries(parts).filter(([_, part]) => !part.footprint).map(([key, part]) => key)}
          {#if invalidParts.length > 0}
            <button class="btn btn-xs btn-warning my-2" onclick={() => onEditMultipleFootprints(...invalidParts)}>
              Fix {invalidParts.length} invalid footprint{invalidParts.length > 1 ? "s" : ""}
            </button>
          {/if}
        {/if}
      </div>
    </div>
  </div>

  {#if parts}
    {#each Object.entries(parts) as [partKey, part]}
        <li class="card card-compact {footprintEditState.partKeyQueue[0] === partKey ? 'animate-blink-bg' : 'bg-base-200'} shadow flex-2 ">
          <div class="card-body flex-row items-center gap-2 px-4 pb-2 pt-2 min-h-12">
            <div class="avatar placeholder flex-shrink-0">
              <div class="bg-base-300 text-base-content rounded-full w-12 h-12 relative">
                <div class="w-6 h-6 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                  {#if part.type === "Resistor"}
                    <IconIconParkOutlineResistor class="w-full h-full" />
                  {:else if part.type === "Transistor"}
                    <IconIconoirElectronicsTransistor class="w-full h-full" />
                  {:else if part.type === "Board"}
                    <IconFluentDeveloperBoard16Regular class="w-full h-full" />
                  {:else}
                    <IconIconParkOutlineFileQuestion class="w-full h-full" />
                  {/if}
                </div>
              </div>
            </div>
            <div class="flex-1 min-w-0 py-2 bg-base-300 px-2 rounded-xl">
              <div class="flex items-baseline gap-2 mb-1">
                <span class="text-xs font-mono text-primary/80">{partKey}</span>
                <h2 class="font-semibold leading-tight truncate">
                  {part.name}
                </h2>
                {#if part.pinCount > 0}
                  <span class="text-xs text-base-content/50 flex-shrink-0">{part.pinCount}p</span>
                {/if}
              </div>
              {#if part.description}
                <p class="text-xs opacity-60 break-words line-clamp-1">
                  {part.description}
                </p>
              {/if}
            </div>
            {#if footprintEditState.partKeyQueue[0] !== partKey}
            <div class="flex flex-col gap-1 flex-shrink-0 pl-2">
              <button
                class="btn btn-sm btn-outline px-3 py-1 bg-base-300 rounded-md {!part.footprint ? 'border-red-700' : ''}"
                title={part.footprint?.name ?? "Click to set footprint"}
                onclick={() => onEditFootprint(partKey)}
                disabled={footprintEditState.partKeyQueue.length !== 0}
              >
                <span class="text-xs truncate block max-w-32">
                  {part.footprint?.name ?? "Create footprint"}
                </span>
                <IconLucideEdit class="w-4 h-4" />
              </button>
            </div>
            {/if}
          </div>
        </li>
    {/each}
  {/if}

  {#if !parts || Object.entries(parts).length === 0}
    <p class="text-center italic opacity-60 py-4">No parts</p>
  {/if}

  <div class="px-4 py-3 flex gap-2">
    <button class="btn btn-sm btn-outline flex-1" onclick={onAddPart}>
      <IconLucidePlus class="w-4 h-4" />
      Add Part
    </button>
    <button class="btn btn-sm btn-outline flex-1" onclick={() => fileInput.click()}>
      <IconLucideUpload class="w-4 h-4" />
      KiCad Netlist
    </button>
    <input
      bind:this={fileInput}
      type="file"
      accept=".net,.xml"
      onchange={handleFileChange}
      class="hidden"
    />
  </div>
</div>
