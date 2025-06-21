<script lang="ts">
  import type { Part } from "xtoedif";
  import Resistor from "virtual:icons/icon-park-outline/resistor"
  import QuestionMark from "virtual:icons/icon-park-outline/file-question"
  import Transistor from "virtual:icons/iconoir/electronics-transistor"
  import Board from "virtual:icons/fluent/developer-board-16-regular"
  import Bolt from "virtual:icons/lucide/bolt"
  
  const { parts } : {
    parts: Record<string, Part>;
  } = $props();
</script>

<div class="overflow-auto">
  <!-- Headers -->
  <div class="flex items-center gap-2 px-4 py-2 bg-base-300 sticky top-0">
    <div class="w-12 flex-shrink-0"></div> <!-- Avatar space -->
    <div class="flex-1 min-w-0 px-2 flex justify-center">
      <h3 class="font-semibold text-sm">Part</h3>
    </div>
    <div class="w-42 flex-shrink-0 pl-2">
      <div class="flex flex-col items-center gap-1">
        <h3 class="font-semibold text-sm">Footprint</h3>
        {#if true}
          <button class="btn btn-xs btn-success my-2">
            Fix all footprints
          </button>
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
                  <Resistor class="w-full h-full"/>
                {:else if part.type === "Transistor"}
                  <Transistor class="w-full h-full"/>
                {:else if part.type === "Board"}
                  <Board class="w-full h-full"/>
                {:else}
                  <QuestionMark class="w-full h-full"/>
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
              class="btn btn-sm btn-outline w-full px-3 py-1 bg-base-300 rounded-md {!part.footprint ?'border-red-700' : ''}"
              title={part.comp.footprint ?? ''}
            >
              <span class="text-xs truncate block w-full">
                {part.comp.footprint?.split(":")[0] ?? ''}
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