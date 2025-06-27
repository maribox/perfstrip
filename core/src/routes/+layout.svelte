<script lang="ts">
	import '../app.css';
	
	let { children } = $props();
</script>
<div class = "min-h-screen w-full flex flex-col">
<div class="navbar bg-base-200 shadow-sm">
  <div class="flex-none">
    <!-- <button class="btn btn-square btn-ghost">
			<Menu class="inline-block h-7 w-7" />
    </button> -->
  </div>
	<a class="flex-1 ml-5" href="/">
		<h1 class="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent w-fit">PerfStrip</h1>
	</a>
  <div class="flex-none">
		<a class="btn btn-square btn-ghost" href="https://github.com/maribox/perfstrip">
			<IconMdiGithub class="inline-block h-7 w-7"/>
		</a>
    <!-- <button class="btn btn-square btn-ghost">
      <More class="inline-block h-7 w-7"/>
    </button> -->
  </div>
</div>

{@render children?.()}

</div>