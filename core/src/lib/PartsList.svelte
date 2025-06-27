<script lang="ts">
  import type { Part } from "xtoedif";
  
  const { parts, onEditFootprint, onEditMultipleFootprints } : {
    parts: Record<string, Part>;
    onEditFootprint: (partKey: string, part: Part) => void;
    onEditMultipleFootprints?: () => void;
  } = $props();

  const hasInvalidFootprints = $derived(() => {
    return Object.values(parts || {}).some(part => 
      !part.comp.footprint || part.comp.footprint.trim() === ''
    );
  });
</script>

<div class="overflow-auto">
  <!-- Headers -->
  <div class="flex items-center gap-2 px-4 py-2 bg-base-300 sticky top-0">
    <div class="w-12 flex-shrink-0"></div> <!-- Avatar space -->
    <div class="flex-1 min-w-0 px-2 flex justify-center">
      <h3 class="font-semibold text-sm">Part</h3>
    </div>      <div class="w-42 flex-shrink-0 pl-2">
        <div class="flex flex-col items-center gap-1">
          <h3 class="font-semibold text-sm">Footprint</h3>
          {#if parts}
            {@const invalidParts = Object.entries(parts).filter(([_, part]) => !part.comp.footprint || part.comp.footprint.trim() === '')}
            {#if invalidParts.length > 0}
              <button 
                class="btn btn-xs btn-warning my-2"
                onclick={() => onEditMultipleFootprints?.()}
              >
                Fix {invalidParts.length} invalid footprint{invalidParts.length > 1 ? 's' : ''}
              </button>
            {/if}
          {/if}
        </div>
      </div>
  </div>

  {#if parts}
  {#each Object.entries(parts) as [key, part]}
    {#if part}
      <li class="card card-compact bg-base-200 shadow flex-2 ">
        <div class="card-body flex-row items-center gap-2 px-4 pb-0 pt-4 min-h-12">
          <div class="avatar placeholder flex-shrink-0">
            <div class="bg-base-300 text-base-content rounded-full w-12 h-12 relative">
              <div class="w-6 h-6 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                {#if part.type === "Resistor"}
                  <IconIconParkOutlineResistor class="w-full h-full"/>
                {:else if part.type === "Transistor"}
                  <IconIconoirElectronicsTransistor class="w-full h-full"/>
                {:else if part.type === "Board"}
                  <!-- <Board class="w-full h-full"/> -->
                  <IconFluentDeveloperBoard16Regular class="w-full h-full"/>
                {:else}
                  <IconIconParkOutlineFileQuestion class="w-full h-full"/>
                {/if}
              </div>
            </div>
          </div>
          <div class="flex-1 min-w-0 py-2 bg-base-300 px-2 rounded-xl" >
            <h2 class="font-semibold leading-tight truncate mb-1">
              {part.comp.value ?? key}
            </h2>
            <p class="text-sm opacity-70 break-words line-clamp-2">
              {part.comp.description ?? '–'}
            </p>
          </div>
          <div class="w-42 flex-shrink-0 pl-2">
            <button
              class="btn btn-sm btn-outline w-full px-3 py-1 bg-base-300 rounded-md {!part.comp.footprint ?'border-red-700' : ''}"
              title={part.comp.footprint ?? 'Click to set footprint'}
              onclick={() => onEditFootprint?.(key, part)}
            >
              <span class="text-xs truncate block w-full">
                {part.comp.footprint?.split(":")[0] ?? 'Set footprint'}
              </span>
            </button>
          </div>
        </div>
      </li>
    {/if}
  {/each}
  {/if}

  {#if (!parts || Object.entries(parts).length === 0)}
    <li class="text-center italic opacity-60">No parts</li>
  {/if}

</div>