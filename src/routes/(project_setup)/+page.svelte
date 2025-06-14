<script lang="ts">
  import { goto } from "$app/navigation";

  let selectedTab: "perfboard" | "stripboard" = $state("perfboard");
  let fileInput: HTMLInputElement;

  function handleUploadFile() {
    fileInput.click();
  }

  function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const spiceContent = e.target?.result as string;
        
        localStorage.setItem('uploadedSpice', spiceContent);
        localStorage.setItem('uploadedFileName', file.name);
        
        console.log('SPICE file uploaded:', file.name);
        console.log('Content:', spiceContent);
        
        goto('/editor/perfboard');
      };
      reader.readAsText(file);
    }
  }

  function handleCreateFromScratch(boardType: "perfboard" | "stripboard") {
    goto(`/editor/${boardType}`);
  }
</script>

<div class="flex flex-col flex-1 w-full justify-center">
  <div class="w-full flex flex-col items-center">
    <h1 class="text-3xl font-bold text-center mb-8">Create New Project</h1>
    
    <div role="tablist" class="tabs tabs-box justify-center w-fit">
      <button class="tab {selectedTab == 'perfboard' ? 'tab-active' : ''}" onclick={() => selectedTab = "perfboard"}>Perfboard</button>
      <button class="tab tab-disabled" onclick={() => selectedTab = "stripboard"}>Stripboard</button>
    </div>

    <div class="flex mt-6 justify-center gap-5 w-full">
      <button class="btn flex-1 max-w-48" onclick={handleUploadFile}>📁 Upload SPICE</button>
      <div class="w-px bg-gradient-to-b from-transparent via-gray-500 to-transparent"></div>
      <button class="btn flex-1 max-w-48" onclick={() => handleCreateFromScratch(selectedTab)}>✨ Create from Scratch</button>
    </div>

    <input 
      type="file" 
      accept=".cir" 
      bind:this={fileInput}
      onchange={handleFileChange}
      style="display: none;"
    />
  </div>
</div>
