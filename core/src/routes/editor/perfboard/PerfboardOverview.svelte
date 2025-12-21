<script lang="ts">
  import { PerfBoard, PartsList } from "$lib/components";
  import { PaneGroup, Pane, PaneResizer } from "paneforge";
  import type { 
    FootprintEditState,
    OnEditFootprintFunction,
    OnEditMultipleFootprintsFunction,
    Part
  } from "$lib/types";

  interface Props {
    parts: Record<string, Part>;
    footprintEditState: FootprintEditState;
    onEditFootprint: OnEditFootprintFunction;
    onFinishCurrentFootprint: () => void;
    onCancelCurrentFootprint: () => void;
    onEditMultipleFootprints: OnEditMultipleFootprintsFunction;
    placedParts: App.PlacedPart[];
  }

  const {
    parts,
    footprintEditState,
    onEditFootprint,
    onFinishCurrentFootprint,
    onCancelCurrentFootprint,
    onEditMultipleFootprints,
    placedParts
  }: Props = $props();
</script>

<PaneGroup direction="horizontal" class="flex-1 h-full">
  <Pane defaultSize={60} class="flex flex-col items-center justify-center">
    <PerfBoard numCols={20} numRows={20} {placedParts} />
  </Pane>

  <PaneResizer class="w-2 bg-accent-content hover:bg-accent cursor-col-resize transition-colors" />

  <Pane defaultSize={40} class="min-w-0 bg-base-200">
    <PartsList 
      {parts}
      {footprintEditState}
      {onEditFootprint}
      {onFinishCurrentFootprint}
      {onCancelCurrentFootprint}
      {onEditMultipleFootprints}
    />
  </Pane>
</PaneGroup>
