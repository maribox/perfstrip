<script lang="ts">
  import { browser } from "$app/environment";
  import { kicad_drawing_map } from "$lib/kicad_fritzing_map";
  import PartsList from "$lib/PartsList.svelte";

  import PerfBoard from "$lib/PerfBoard.svelte";
  import { convertKicadToParts, type Part } from "xtoedif";
  import { PaneGroup, Pane, PaneResizer } from "paneforge";
  import FootprintEditor from "$lib/FootprintEditor.svelte";
  type Point = [number, number];

  let placedParts: App.PlacedPart[] = $state([]);
  let parts: Record<string, Part> = $state({});
  let footprintNamesToEdit: string[] = $state([]);
  let partsToEdit = $derived(Object.fromEntries(
    footprintNamesToEdit
      .filter(key => key in parts)
      .map(key => [key, parts[key]])
  ));

  let showFootprintEditor = $state(false);
  const onEditFootprint = () => {
    showFootprintEditor = true;
  };
  const onClose = () => {
    showFootprintEditor = false;
  };
  const onOk = () => {
    console.log("pressed ok");
    showFootprintEditor = false;
  };

  if (browser) {
    try {
      let spice = localStorage.getItem("uploadedSpice");
      if (spice) {
        const converted = convertKicadToParts(spice);
        parts = converted;

        let partI = -1;
        for (let [partKey, part] of Object.entries(converted)) {
          partI++;
          placedParts.push({
            position: [2, partI * 2],
            width: 100,
            height: 100,
            lib_name: kicad_drawing_map[part.comp.footprint.split(":")[0]] ?? ["fritzing_parts", "resistor_220"],
            part: part,
          });
        }
        console.log(placedParts);
      } else {
        console.log("No SPICE file found in localStorage");
      }
    } catch (e) {
      console.error(e);
      console.log("failed to get SPICE file");
    }
  }
</script>

<PaneGroup direction="horizontal" class="flex-1 h-full">
  <!-- left side: PerfBoard, starts at 60 % width -->
  <Pane defaultSize={60} class="flex items-center justify-center">
    <PerfBoard numCols={20} numRows={20} {placedParts} />
  </Pane>

  <PaneResizer class="w-2 bg-accent-content hover:bg-accent  cursor-col-resize transition-colors" />

  <Pane defaultSize={40} class="min-w-0 bg-base-200">
    <PartsList {parts} {onEditFootprint} />
  </Pane>
</PaneGroup>
{#if showFootprintEditor}
  <FootprintEditor {onClose} {onOk} parts={partsToEdit} />
{/if}
