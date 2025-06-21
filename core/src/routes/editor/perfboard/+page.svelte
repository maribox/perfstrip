<script lang="ts">
  // note: if we execute the spice stuff onMount, we might get a small delay, but using if (browser) doesn't work with adapter-static 
  import { browser } from "$app/environment";
    import { kicad_drawing_map } from "$lib/kicad_fritzing_map";
    import PartsList from "$lib/PartsList.svelte";
  
  import PerfBoard from "$lib/PerfBoard.svelte";
  import {convertKicadToParts, type Part} from "xtoedif"

  type Point = [number, number]
  
  let placedParts : App.PlacedPart[] = []
  let parts : Record<string, Part>;

  if (browser) {
  try {
    let spice = localStorage.getItem("uploadedSpice");
    if (spice) {
      parts = convertKicadToParts(spice);
      console.log(parts);
      let partI = -1;
      for (let [partKey, part] of Object.entries(parts)) {
        partI++
        placedParts.push({
          position: [2, partI*2],
          width: 100,
          height: 100,
          part: part,
          lib_name: kicad_drawing_map[part.comp.footprint.split(":")[0]] ?? ["fritzing_parts", "resistor_220"]
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
    <div class="flex-4 flex flex-col min-h-full bg-base-200 gap-3 min-w-0">
      <PartsList parts={parts}/>
    </div>
</div>
