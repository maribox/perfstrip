<script lang="ts">
  import type { Part, Footprint } from "$lib/types";
  import type { VariableFootprintSettings } from "$lib/types";

  interface Props {
    currentFootprint: Footprint;
    availableFootprints: string[];
    parts: Record<string, Part>;
    isEditingSharedFootprint: boolean;
    partsWithSameFootprint: Array<{ key: string; part: Part }>;
    currentPart: Part | null;
    variableFootprintSettings: VariableFootprintSettings;
    onFootprintNameChange: (name: string) => void;
    onLoadExistingFootprint: (name: string) => void;
    onSwitchFootprintType: (type: "fixed" | "variable") => void;
    onMinLengthChange: (value: number) => void;
    onMaxLengthChange: (value: number) => void;
  }

  const { 
    currentFootprint,
    availableFootprints,
    parts,
    isEditingSharedFootprint,
    partsWithSameFootprint,
    currentPart,
    variableFootprintSettings,
    onFootprintNameChange,
    onLoadExistingFootprint,
    onSwitchFootprintType,
    onMinLengthChange,
    onMaxLengthChange
  }: Props = $props();

  let dropdownOpen = $state(false);
  let filteredFootprints = $state(availableFootprints);
</script>

<div class="bg-base-200 rounded p-3 border">
  {#if isEditingSharedFootprint}
    <div class="alert alert-warning alert-sm mb-3">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
      </svg>
      <div>
        <div class="font-medium text-sm">Shared Footprint</div>
        <div class="text-xs">Changes will affect {partsWithSameFootprint.length} parts: {partsWithSameFootprint.map(p => p.part.name).join(', ')}</div>
      </div>
    </div>
  {/if}

  <div class="mb-3">
    <div class="flex items-center gap-3 mb-1">
      <div class="flex-1">
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
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>

          {#if dropdownOpen}
            <div class="absolute top-full left-0 right-0 mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
              {#if filteredFootprints.length > 0}
                {#each filteredFootprints as footprintName}
                  <button
                    type="button"
                    class="w-full text-left px-3 py-2 text-sm hover:bg-base-200 border-b border-base-200 last:border-b-0"
                    onclick={() => {
                      currentFootprint.name = footprintName;
                      onFootprintNameChange(footprintName);
                      onLoadExistingFootprint(footprintName);
                      dropdownOpen = false;
                    }}
                  >
                    {footprintName}
                  </button>
                {/each}
              {:else}
                <div class="px-3 py-2 text-sm text-base-content/50">No footprints available</div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
      
      <div>
        <label class="block text-sm font-medium mb-1">Type</label>
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

  {#if currentFootprint.layout.type === 'variable'}
    <div class="mb-3">
      <div class="text-sm font-medium mb-2">Distance Settings</div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="min-distance" class="block text-sm font-medium mb-1">Min Distance</label>
          <input 
            id="min-distance"
            type="number" 
            bind:value={variableFootprintSettings.minLength}
            min="1" 
            max="20"
            class="input input-sm input-bordered w-full"
            onchange={() => onMinLengthChange(variableFootprintSettings.minLength)}
          />
        </div>
        <div>
          <label for="max-distance" class="block text-sm font-medium mb-1">Max Distance</label>
          <input 
            id="max-distance"
            type="number" 
            bind:value={variableFootprintSettings.maxLength}
            min="1" 
            max="20"
            class="input input-sm input-bordered w-full"
            onchange={() => onMaxLengthChange(variableFootprintSettings.maxLength)}
          />
        </div>
      </div>
    </div>
  {/if}
</div>
