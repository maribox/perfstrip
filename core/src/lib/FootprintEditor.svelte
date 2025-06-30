<script lang="ts">
  import { Pane, PaneGroup, PaneResizer } from "paneforge";
  import PerfBoard from "./PerfBoard.svelte";
  import type { Part } from "xtoedif";

  interface Props {
    onClose: () => void;
    onOk: () => void;
    parts: Record<string, Part>;
  }

  const { onClose, onOk, parts }: Props = $props();

  let currentPartKey = $state(Object.keys(parts)[0]);
  // TODO fix undefined
  let currentPart: Part = $derived(parts[currentPartKey]);
</script>

<div class="fixed inset-0 bg-black opacity-50"></div>
<div class="fixed inset-10 bg-base-100 rounded-lg">
  <div class="absolute right-2 top-2 bg-base-300 w-6 h-6 hover:opacity-50 rounded border-2 transition">
    <IconSystemUiconsCross onclick={onClose} class="w-full h-full" />
  </div>

  <PaneGroup direction="horizontal">
    <Pane defaultSize={60} class="flex items-center justify-center">
      <PerfBoard numCols={20} numRows={20} placedParts={[]} />
    </Pane>

    <PaneResizer class="w-2 bg-accent-content hover:bg-accent  cursor-col-resize transition-colors" />

    <Pane defaultSize={40} class="min-w-0 bg-base-200 flex">
      <div class="w-full h-full flex flex-col p-4">
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">Name</label>
          <input
            type="text"
            bind:value={
              () => currentPart.footprint?.libName ?? "",
              (v) => {
                currentPart.footprint ??= { name: "", layout: {type: "fixed", pins: []} };
                currentPart.footprint.name = v;
              }
            }
            class="input input-bordered w-full"
            placeholder="Enter footprint name"
          />
        </div>

        <div class="flex-1 mb-4">
          <label class="block text-sm font-medium mb-2">Pins</label>
          <div class="bg-base-300 rounded p-3 max-h-60 overflow-y-auto">
            {#if Object.entries(parts).length > 0 && currentPart.footprint?.layout.type == "fixed"}
              {#each currentPart.footprint.layout.pins as pin}
                <div class="py-1">{pin}</div>
              {/each}
            {/if}
          </div>
        </div>

        <div class="flex gap-2 mt-auto">
          <button class="btn btn-primary flex-1" onclick={onOk}>OK</button>
          <button class="btn btn-secondary flex-1" onclick={onClose}>Cancel</button>
        </div>
      </div>
    </Pane>
  </PaneGroup>
</div>
