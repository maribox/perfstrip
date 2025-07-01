<script lang="ts">
  interface Props {
    minLength: number;
    maxLength: number;
    onMinLengthChange: (value: number) => void;
    onMaxLengthChange: (value: number) => void;
  }

  let { 
    minLength = $bindable(),
    maxLength = $bindable(),
    onMinLengthChange,
    onMaxLengthChange
  }: Props = $props();
</script>

<div class="flex-1 grid grid-cols-2 gap-3 max-w-md">
  <div>
    <label for="min-distance" class="block text-sm font-medium mb-1">Min Distance</label>
    <input 
      id="min-distance"
      type="number" 
      bind:value={minLength}
      min="1" 
      max="20"
      class="input input-sm input-bordered w-full"
      onchange={() => onMinLengthChange?.(minLength)}
    />
  </div>
  <div>
    <label for="max-distance" class="block text-sm font-medium mb-1">Max Distance</label>
    <input 
      id="max-distance"
      type="number" 
      bind:value={maxLength}
      min="1" 
      max="20"
      class="input input-sm input-bordered w-full"
      onchange={() => onMaxLengthChange?.(maxLength)}
    />
  </div>
</div>
