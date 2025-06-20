<script lang="ts">
  // note: if we execute the spice stuff onMount, we might get a small delay, but using if (browser) doesn't work with adapter-static 
  import { browser } from "$app/environment";
    import { kicad_drawing_map } from "$lib/kicad_fritzing_map";

  import PerfBoard from "$lib/PerfBoard.svelte";
  import {convertKicadToParts, type Part} from "xtoedif"

  type Point = [number, number]
  
  let placedParts : App.PlacedPart[] = []


  if (browser) {
  try {
    let spice = localStorage.getItem("uploadedSpice");
    if (spice) {
      let parts = convertKicadToParts(spice);
      console.log(parts);
      let partI = -1;
      for (let [partKey, part] of Object.entries(parts)) {
        partI++
        placedParts.push({
          position: [2, partI*2],
          width: 100,
          height: 100,
          part: part,
          fritzing_name: kicad_drawing_map[part.comp.footprint.split(":")[0]] ?? "resistor_220"
        })
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

<div class="flex h-full flex-1 items-stretch justify-center w-full">
    <div class="flex-6 flex items-center justify-center">
    <PerfBoard numCols={20} numRows={20} placedParts={placedParts} />
    </div>
    <div class="flex-4 min-h-full  bg-base-200">
    </div>
</div>
