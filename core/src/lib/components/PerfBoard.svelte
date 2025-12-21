<script lang="ts">
  import type { PinPosition } from "xtoedif";
  import PerfBoardEdgeLabels from "./PerfBoardEdgeLabels.svelte";

  interface Props {
    numRows: number;
    numCols: number;
    placedParts: App.PlacedPart[];
    onPadClick?: (x: number, y: number) => void;
    selectedPins?: PinPosition[];
    componentBody?: { x: number; y: number; width: number; height: number }[] | null;
    onBodyDrag?: (x: number, y: number, width: number, height: number) => void;
    onPinDrag?: (x: number, y: number, width: number, height: number) => void;
    maxWidth?: number;
    maxHeight?: number;
    allowScaleUp?: boolean;
    maxScale?: number;
  }
  let props: Props = $props();

  const PAD_SPACING = 5;
  const SIDE_PADDING = 15;
  const PAD_RADIUS = 10;

  const padDimension = PAD_RADIUS * 2 + PAD_SPACING;

  let idealWidth = $derived(SIDE_PADDING * 2 + props.numCols * padDimension);
  let idealHeight = $derived(SIDE_PADDING * 2 + props.numRows * padDimension);

  let maxWidth = $derived(props.maxWidth || (typeof window !== "undefined" ? window.innerWidth * 0.8 : 800));
  let maxHeight = $derived(props.maxHeight || (typeof window !== "undefined" ? window.innerHeight * 0.7 : 600));

  let maxScale = $derived(props.maxScale ?? (props.allowScaleUp ? Number.POSITIVE_INFINITY : 1));
  let scale = $derived(Math.min(maxScale, maxWidth / idealWidth, maxHeight / idealHeight));

  let svgWidth = $derived(idealWidth * scale);
  let svgHeight = $derived(idealHeight * scale);
  let scaledPadding = $derived(SIDE_PADDING * scale);
  let scaledSpacing = $derived(padDimension * scale);
  let scaledPadRadius = $derived(PAD_RADIUS * scale);
  let scaledHoleRadius = $derived(PAD_RADIUS * scale * 0.6);

  let isDragging = $state(false);
  let dragStart = $state({ x: 0, y: 0 });
  let dragEnd = $state({ x: 0, y: 0 });
  let dragMode = $state<"none" | "body" | "pins">("none");
  let suppressClick = $state(false);

  const handlePadClick = (colI: number, rowI: number) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (props.onPadClick) {
      props.onPadClick(colI, rowI);
    }
  };

  const getPinKey = (colI: number, rowI: number) => `${colI},${rowI}`;
  let pinsByPosition = $derived.by(() => {
    const map = new Map<string, PinPosition[]>();
    (props.selectedPins ?? []).forEach((pin) => {
      const key = getPinKey(pin.x, pin.y);
      const current = map.get(key) ?? [];
      current.push(pin);
      map.set(key, current);
    });
    return map;
  });

  const getPinsAtPosition = (colI: number, rowI: number) => {
    return pinsByPosition.get(getPinKey(colI, rowI)) ?? [];
  };

  const getOrbitPositions = (cx: number, cy: number, radius: number, count: number) => {
    if (count <= 0) return [];
    const step = (Math.PI * 2) / count;
    const start = -Math.PI / 2;
    return Array.from({ length: count }, (_, index) => ({
      x: cx + Math.cos(start + step * index) * radius,
      y: cy + Math.sin(start + step * index) * radius,
    }));
  };


  const isPinSelected = (colI: number, rowI: number) => {
    return getPinsAtPosition(colI, rowI).length > 0;
  };

  const handleMouseDown = (event: MouseEvent, colI: number, rowI: number) => {
    if (event.shiftKey && props.onBodyDrag) {
      isDragging = true;
      dragMode = "body";
      dragStart = { x: colI, y: rowI };
      dragEnd = { x: colI, y: rowI };
      event.preventDefault();
    } else if (props.onPinDrag) {
      isDragging = true;
      dragMode = "pins";
      dragStart = { x: colI, y: rowI };
      dragEnd = { x: colI, y: rowI };
      event.preventDefault();
    }
  };

  const handleMouseMove = (event: MouseEvent, colI: number, rowI: number) => {
    if (isDragging) {
      dragEnd = { x: colI, y: rowI };
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      const x = Math.min(dragStart.x, dragEnd.x);
      const y = Math.min(dragStart.y, dragEnd.y);
      const width = Math.abs(dragEnd.x - dragStart.x) + 1;
      const height = Math.abs(dragEnd.y - dragStart.y) + 1;

      if (dragMode === "body" && props.onBodyDrag) {
        props.onBodyDrag(x, y, width, height);
        suppressClick = true;
      } else if (dragMode === "pins" && props.onPinDrag) {
        if (width > 1 || height > 1) {
          props.onPinDrag(x, y, width, height);
          suppressClick = true;
        }
      }

      isDragging = false;
      dragMode = "none";
    }
  };

  const isInDragSelection = (colI: number, rowI: number) => {
    if (!isDragging) return false;
    const minX = Math.min(dragStart.x, dragEnd.x);
    const maxX = Math.max(dragStart.x, dragEnd.x);
    const minY = Math.min(dragStart.y, dragEnd.y);
    const maxY = Math.max(dragStart.y, dragEnd.y);
    return colI >= minX && colI <= maxX && rowI >= minY && rowI <= maxY;
  };

  const isInBody = (colI: number, rowI: number) => {
    if (!props.componentBody || !Array.isArray(props.componentBody)) return false;
    return props.componentBody.some((body) => {
      const { x, y, width, height } = body;
      return colI >= x && colI < x + width && rowI >= y && rowI < y + height;
    });
  };
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg
  width={svgWidth}
  height={svgHeight}
  viewBox="0 0 {svgWidth} {svgHeight}"
  onmouseup={handleMouseUp}
  role="application"
  aria-label="Interactive perfboard for component placement"
  style="user-select: none;"
>
  <!-- PCB Background -->
  <rect width={svgWidth} height={svgHeight} fill="#152347" />
  <PerfBoardEdgeLabels
    numRows={props.numRows}
    numCols={props.numCols}
    {scaledPadding}
    {scaledSpacing}
    {scaledPadRadius}
    {svgWidth}
    {svgHeight}
  />
  <g>
    {#each Array(props.numRows) as _, rowI}
      {#each Array(props.numCols) as _, colI}
        <!-- Body highlighting -->
        {#if isInBody(colI, rowI)}
          <rect
            x={scaledPadding + colI * scaledSpacing}
            y={scaledPadding + rowI * scaledSpacing}
            width={scaledSpacing}
            height={scaledSpacing}
            fill="rgba(34, 197, 94, 0.2)"
            stroke="rgba(34, 197, 94, 0.6)"
            stroke-width="1"
          />
        {/if}

        <!-- Drag selection highlighting -->
        {#if isInDragSelection(colI, rowI)}
          {@const isPinDrag = dragMode === "pins"}
          <rect
            x={scaledPadding + colI * scaledSpacing}
            y={scaledPadding + rowI * scaledSpacing}
            width={scaledSpacing}
            height={scaledSpacing}
            fill={isPinDrag ? "rgba(168, 85, 247, 0.3)" : "rgba(59, 130, 246, 0.3)"}
            stroke={isPinDrag ? "rgba(168, 85, 247, 0.8)" : "rgba(59, 130, 246, 0.8)"}
            stroke-width="1"
          />
        {/if}

        <!-- Hit target -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <rect
          x={scaledPadding + colI * scaledSpacing}
          y={scaledPadding + rowI * scaledSpacing}
          width={scaledSpacing}
          height={scaledSpacing}
          fill="transparent"
          style="cursor: {props.onPadClick ? 'pointer' : 'default'}"
          role={props.onPadClick ? "button" : "presentation"}
          tabindex={props.onPadClick ? 0 : -1}
          aria-label={props.onPadClick
            ? `Perfboard hole at column ${colI + 1}, row ${rowI + 1}${isPinSelected(colI, rowI) ? ` - ${getPinsAtPosition(colI, rowI).length} pin${getPinsAtPosition(colI, rowI).length === 1 ? "" : "s"} placed` : ""}`
            : undefined}
          onclick={() => handlePadClick(colI, rowI)}
          onkeydown={(e) => (e.key === "Enter" || e.key === " " ? handlePadClick(colI, rowI) : null)}
          onmousedown={(e) => handleMouseDown(e, colI, rowI)}
          onmousemove={(e) => handleMouseMove(e, colI, rowI)}
        />

        <!-- Copper pad -->
        <circle
          cx={scaledPadding + colI * scaledSpacing + scaledSpacing * 0.5}
          cy={scaledPadding + rowI * scaledSpacing + scaledSpacing * 0.5}
          r={scaledPadRadius}
          fill={isPinSelected(colI, rowI) ? "#FFD700" : "#CD7F32"}
          stroke={isPinSelected(colI, rowI) ? "#FFA500" : "none"}
          stroke-width={isPinSelected(colI, rowI) ? "2" : "0"}
          style="pointer-events: none; opacity: 1"
        />

        <!-- Drill hole -->
        <circle
          cx={scaledPadding + colI * scaledSpacing + scaledSpacing * 0.5}
          cy={scaledPadding + rowI * scaledSpacing + scaledSpacing * 0.5}
          r={scaledHoleRadius}
          fill="#1a1a1a"
          style="pointer-events: none"
        />

        <!-- Pin number labels for selected pins -->
        {@const pinsAtHole = getPinsAtPosition(colI, rowI)}
        {@const centerX = scaledPadding + colI * scaledSpacing + scaledSpacing * 0.5}
        {@const centerY = scaledPadding + rowI * scaledSpacing + scaledSpacing * 0.5}
        {#if pinsAtHole.length === 1}
          {@const pin = pinsAtHole[0]}
          {#if pin}
            <text x={centerX} y={centerY} text-anchor="middle" dominant-baseline="central" font-size={Math.max(10, scaledPadRadius * 1.0)} fill="white" font-weight="bold" style="pointer-events: none">
              {pin.pinNumber}
            </text>
          {/if}
        {:else if pinsAtHole.length > 1}
          {@const bubbleRadius = Math.max(4, scaledPadRadius * 0.50)}
          {@const bubbleRadiusActive = Math.max(6, scaledPadRadius * 0.75)}
          {@const orbitRadius = Math.max(6, scaledPadRadius * 0.6)}
          {@const pinFontSize = Math.max(6, scaledPadRadius * 0.55)}
          {@const pinFontSizeActive = Math.max(7, scaledPadRadius * 0.7)}
          {@const orbit = getOrbitPositions(centerX, centerY, orbitRadius, pinsAtHole.length)}
          {#each pinsAtHole as pin, index}
            {@const spot = orbit[index]}
            {@const isLatest = index === pinsAtHole.length - 1}
            <circle cx={spot.x} cy={spot.y} r={isLatest ? bubbleRadiusActive : bubbleRadius} fill="#1f2937" opacity="0.9" style="pointer-events: none" />
            <text
              x={spot.x}
              y={spot.y}
              text-anchor="middle"
              dominant-baseline="central"
              font-size={isLatest ? pinFontSizeActive : pinFontSize}
              fill="white"
              font-weight="bold"
              style="pointer-events: none"
            >
              {pin.pinNumber}
            </text>
          {/each}
        {/if}
      {/each}
    {/each}
  </g>
</svg>
