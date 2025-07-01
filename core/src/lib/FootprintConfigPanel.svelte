<script lang="ts">
  import type { Part } from "xtoedif";

  interface FootprintLayout {
    type: "fixed" | "variable";
    pins?: any[];
    minLength?: number;
    maxLength?: number;
  }

  interface Footprint {
    name: string;
    layout: FootprintLayout;
  }

  interface Props {
    currentFootprint: Footprint;
    availableFootprints: string[];
    parts: Record<string, Part>;
    isEditingSharedFootprint: boolean;
    partsWithSameFootprint: Array<{ key: string; part: Part }>;
    currentPart: Part | null;
    onFootprintNameChange: (name: string) => void;
    onLoadExistingFootprint: (name: string) => void;
    onSwitchFootprintType: (type: "fixed" | "variable") => void;
  }

  const { 
    currentFootprint,
    availableFootprints,
    parts,
    isEditingSharedFootprint,
    partsWithSameFootprint,
    currentPart,
    onFootprintNameChange,
    onLoadExistingFootprint,
    onSwitchFootprintType
  }: Props = $props();

  let dropdownOpen = $state(false);
  let filteredFootprints = $state(availableFootprints);

  $effect(() => {
    filteredFootprints = availableFootprints;
  });
</script>

<div class="bg-base-200 rounded-lg p-3 shrink-0">
  {#if isEditingSharedFootprint}
    <div class="alert alert-warning mb-3 p-2">
      <svg class="w-4 h-4 stroke-current" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z"></path>
      </svg>
      <div class="text-xs">
        <div class="font-medium">Shared Footprint</div>
        <div>Changes will affect {partsWithSameFootprint.length} parts: {partsWithSameFootprint.map(p => p.part.name).join(', ')}</div>
      </div>
    </div>
  {/if}

  <div class="mb-3">
    <label for="footprint-input" class="block text-sm font-medium mb-1">Footprint</label>
    <div class="relative">
      <input 
        id="footprint-input"
        type="text" 
        bind:value={currentFootprint.name}
        class="input input-sm input-bordered w-full pr-8" 
        placeholder="Type or select footprint..."
        onfocus={() => {
          dropdownOpen = true;
          filteredFootprints = availableFootprints;
        }}
        oninput={(e) => {
          const target = e.target as HTMLInputElement;
          const value = target.value.trim();
          
          dropdownOpen = true;
          onFootprintNameChange(value);
          
          if (value.length === 0) {
            filteredFootprints = availableFootprints;
          } else {
            filteredFootprints = availableFootprints.filter(name => 
              name.toLowerCase().includes(value.toLowerCase())
            );
          }
        }}
        onblur={() => {
          setTimeout(() => {
            dropdownOpen = false;
          }, 150);
        }}
        onchange={(e) => {
          const target = e.target as HTMLInputElement;
          const selectedName = target.value.trim();
          
          if (!selectedName) return;
          
          if (availableFootprints.includes(selectedName) && selectedName !== currentFootprint.name) {
            onLoadExistingFootprint(selectedName);
          }
        }}
      />
      
      <button 
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-base-300 rounded transition-colors"
        aria-label="Toggle footprint dropdown"
        onclick={() => {
          dropdownOpen = !dropdownOpen;
          if (dropdownOpen) {
            filteredFootprints = availableFootprints;
            setTimeout(() => {
              document.getElementById('footprint-input')?.focus();
            }, 0);
          }
        }}
        tabindex="-1"
      >
        <svg class="w-3 h-3 text-base-content/50 transition-transform" class:rotate-180={dropdownOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>
      
      {#if dropdownOpen}
        <div class="absolute top-full left-0 right-0 mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
          {#if filteredFootprints.length > 0}
            {#each filteredFootprints as footprintName}
              {@const partsUsingFootprint = Object.values(parts).filter(p => p.footprint?.name === footprintName)}
              <button
                type="button"
                class="w-full text-left px-3 py-2 text-sm hover:bg-base-200 transition-colors border-b border-base-300/30 last:border-b-0 {footprintName === currentFootprint.name ? 'bg-primary/10 text-primary' : ''}"
                onclick={() => {
                  onFootprintNameChange(footprintName);
                  if (availableFootprints.includes(footprintName)) {
                    onLoadExistingFootprint(footprintName);
                  }
                  dropdownOpen = false;
                }}
              >
                <div class="font-medium">{footprintName}</div>
                <div class="text-xs text-base-content/60 mt-0.5">
                  {#if partsUsingFootprint.length > 0}
                    Used by: {partsUsingFootprint.map(p => p.name).join(', ')}
                  {:else}
                    Default footprint (not used by any parts)
                  {/if}
                </div>
              </button>
            {/each}
          {:else if currentFootprint.name.trim()}
            <div class="px-3 py-2 text-sm text-base-content/60">
              <div class="flex items-center gap-2">
                <span class="badge badge-success badge-xs">New</span>
                <span>Create "{currentFootprint.name}"</span>
              </div>
            </div>
          {:else}
            <div class="px-3 py-2 text-sm text-base-content/50">No footprints available</div>
          {/if}
        </div>
      {/if}
    </div>

    {#if currentFootprint.name}
      {@const isExisting = availableFootprints.includes(currentFootprint.name)}
      {@const isOriginalName = currentFootprint.name === currentPart?.footprint?.name}
      <div class="flex items-center gap-2 text-xs mt-1">
        {#if isExisting && isOriginalName}
          <span class="badge badge-secondary badge-xs">Current</span>
          <span class="text-base-content/70">Editing the part's current footprint</span>
        {:else if isExisting}
          <span class="badge badge-warning badge-xs">Existing</span>
          <span class="text-base-content/70">Will overwrite existing footprint with same name</span>
        {:else if currentFootprint.name.trim() !== ""}
          <span class="badge badge-success badge-xs">New</span>
          <span class="text-base-content/70">Creating new footprint variant</span>
        {/if}
      </div>
    {/if}
  </div>

  <div class="mb-3">
    <div class="join">
      <button 
        class="btn btn-sm join-item {currentFootprint.layout.type === 'fixed' ? 'btn-primary' : 'btn-outline'}" 
        onclick={() => onSwitchFootprintType('fixed')}
      >
        Fixed
      </button>
      <button 
        class="btn btn-sm join-item {currentFootprint.layout.type === 'variable' ? 'btn-primary' : 'btn-outline'}" 
        onclick={() => onSwitchFootprintType('variable')}
      >
        Variable
      </button>
    </div>
  </div>
</div>
