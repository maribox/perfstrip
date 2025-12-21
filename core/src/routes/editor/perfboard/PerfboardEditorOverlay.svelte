<script lang="ts">
  import type { ComponentProps } from "svelte";
  import FootprintEditorView from "$lib/components/footprint-editor/FootprintEditorView.svelte";

  interface Props {
    editorProps: ComponentProps<typeof FootprintEditorView>;
  }

  const { editorProps }: Props = $props();
</script>

<div class="fixed inset-0 z-50 flex items-start justify-center bg-base-200/70 backdrop-blur-sm p-0">
  <div class="w-full h-full max-w-none bg-base-100 border border-base-300 shadow-2xl rounded-none overflow-hidden">
    <FootprintEditorView {...editorProps} />
  </div>
</div>
