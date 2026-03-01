<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';

	let { children } = $props();

	let isPerf = $derived($page.url.pathname.includes('perfboard'));
	let isStrip = $derived($page.url.pathname.includes('stripboard'));
</script>
<div class = "min-h-screen w-full flex flex-col">
<div class="navbar bg-base-200 shadow-sm">
  <div class="flex-none">
    <!-- <button class="btn btn-square btn-ghost">
			<Menu class="inline-block h-7 w-7" />
    </button> -->
  </div>
	<div class="flex-1 ml-5 flex items-baseline gap-0">
		<a href="/editor/perfboard" class="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent transition-opacity {isPerf ? 'opacity-100' : 'opacity-40 hover:opacity-70'}">Perf</a>
		<a href="/editor/stripboard" class="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent transition-opacity {isStrip ? 'opacity-100' : 'opacity-40 hover:opacity-70'}">Strip</a>
	</div>
  <div class="flex-none">
		<a class="btn btn-square btn-ghost" href="https://github.com/maribox/perfstrip">
			<IconMdiGithub class="inline-block h-7 w-7"/>
		</a>
    <!-- <button class="btn btn-square btn-ghost">
      <More class="inline-block h-7 w-7"/>
    </button> -->
  </div>
</div>

{#key $page.url.pathname}
{@render children?.()}
{/key}

</div>