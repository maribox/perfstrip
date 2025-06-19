<script lang="ts">
  // note: if we execute the spice stuff onMount, we might get a small delay, but using if (browser) doesn't work with adapter-static 
  import { browser } from "$app/environment";

  import PerfBoard from "$lib/PerfBoard.svelte";
  import {convertKicadToParts, type Part} from "xtoedif"

  type Point = [number, number]
  type PlacedPart = {
    part: Part;
    position: Point;
    width: number;
    height: number;
  }

  if (browser) {
  try {
    let spice = localStorage.getItem("uploadedSpice");
    if (spice) {
      let parts = convertKicadToParts(spice);
      
    } else {
      console.log("No SPICE file found in localStorage");
    }
  } catch (e) {
    console.error(e);
    console.log("failed to get SPICE file");
  }
  }
</script>

<div class="flex h-full flex-1 items-stretch justify-center w-full">
    <div class="flex-6 flex items-center justify-center">
    <PerfBoard numCols={50} numRows={50} />
    </div>
    <div class="flex-4 min-h-full  bg-base-200">
    </div>
</div>
