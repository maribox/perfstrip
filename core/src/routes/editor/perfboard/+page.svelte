<script lang="ts">
  import { browser } from "$app/environment";
  import { kicad_drawing_map } from "$lib/kicad_fritzing_map";
  import PartsList, { type FootprintEditState, type OnEditFootprintFunction, type OnEditMultipleFootprintsFunction } from "$lib/PartsList.svelte";

  import PerfBoard from "$lib/PerfBoard.svelte";
  import { convertKicadToParts, type Part } from "xtoedif";
  import { PaneGroup, Pane, PaneResizer } from "paneforge";

  let placedParts: App.PlacedPart[] = $state([]);
  let parts: Record<string, Part> = $state({});
  let footprintNamesToEdit: string[] = $state([]);

  let footprintEditState : FootprintEditState = $state({
    partKeyQueue: []
  });

  const onEditFootprint: OnEditFootprintFunction = (partKey: string) => {
    footprintEditState.partKeyQueue.push(partKey);
  };
  const onFinishCurrentFootprint = () => {
    footprintEditState.partKeyQueue.shift()
  };

  const onCancelCurrentFootprint = () => {
    footprintEditState.partKeyQueue.shift()
  }

  const onEditMultipleFootprints : OnEditMultipleFootprintsFunction = (...partKeys: string[]) => {
    footprintEditState.partKeyQueue.push(...partKeys)
  }

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
            image: kicad_drawing_map[part.comp.footprint.split(":")[0]] ?? ["fritzing_parts", "resistor_220"],
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
    <PartsList {parts} {footprintEditState} {onEditFootprint} {onFinishCurrentFootprint} {onCancelCurrentFootprint} {onEditMultipleFootprints}/>
  </Pane>
</PaneGroup>

