<script lang="ts">
  import type { PinPosition } from "xtoedif";
  import PerfBoardEdgeLabels from "./PerfBoardEdgeLabels.svelte";

  type PartPlacement = {
    partKey: string;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
    pins: PinPosition[];
  };

  type RatsnestLine = { path: Array<{ x: number; y: number }>; netName: string; failed?: boolean; layer?: number };

  type StripCut = { row: number; col: number };
  type BoardType = "perfboard" | "stripboard";

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
    partPlacements?: PartPlacement[];
    fixedPartKeys?: Set<string>;
    ratsnestLines?: RatsnestLine[];
    onPartMove?: (partKey: string, newX: number, newY: number) => void;
    onPartRotate?: (partKey: string) => void;
    onUnfixPart?: (partKey: string) => void;
    boardType?: BoardType;
    stripCuts?: StripCut[];
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

  // Part drag-to-move state
  const DRAG_THRESHOLD = 8; // minimum px before drag starts
  let pendingDragPart = $state<{ partKey: string; startClientX: number; startClientY: number; placement: PartPlacement } | null>(null);
  let draggingPartKey = $state<string | null>(null);
  let dragPartOffset = $state({ dx: 0, dy: 0 });
  let dragPartCurrent = $state({ x: 0, y: 0 });

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

  const pixelToGrid = (clientX: number, clientY: number, svgEl: SVGSVGElement) => {
    const rect = svgEl.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    return {
      x: Math.round((mouseX - scaledPadding) / scaledSpacing - 0.5),
      y: Math.round((mouseY - scaledPadding) / scaledSpacing - 0.5),
    };
  };

  const handlePartMouseDown = (event: MouseEvent, placement: PartPlacement) => {
    if (!props.onPartMove) return;
    event.preventDefault();
    event.stopPropagation();
    pendingDragPart = {
      partKey: placement.partKey,
      startClientX: event.clientX,
      startClientY: event.clientY,
      placement,
    };
  };

  const handleSvgMouseMove = (event: MouseEvent) => {
    // Check if pending drag should start (threshold met)
    if (pendingDragPart && !draggingPartKey) {
      const dx = event.clientX - pendingDragPart.startClientX;
      const dy = event.clientY - pendingDragPart.startClientY;
      if (Math.abs(dx) + Math.abs(dy) >= DRAG_THRESHOLD) {
        const svgEl = event.currentTarget as SVGSVGElement;
        const grid = pixelToGrid(pendingDragPart.startClientX, pendingDragPart.startClientY, svgEl);
        draggingPartKey = pendingDragPart.partKey;
        dragPartOffset = { dx: grid.x - pendingDragPart.placement.offsetX, dy: grid.y - pendingDragPart.placement.offsetY };
        dragPartCurrent = { x: pendingDragPart.placement.offsetX, y: pendingDragPart.placement.offsetY };
        pendingDragPart = null;
      }
      return;
    }

    if (!draggingPartKey) return;
    const svgEl = event.currentTarget as SVGSVGElement;
    const grid = pixelToGrid(event.clientX, event.clientY, svgEl);
    dragPartCurrent = {
      x: Math.max(0, grid.x - dragPartOffset.dx),
      y: Math.max(0, grid.y - dragPartOffset.dy),
    };
  };

  const handleMouseUp = () => {
    // Cancel pending drag (threshold never met)
    if (pendingDragPart) {
      pendingDragPart = null;
      return;
    }

    // Part drag finalization
    if (draggingPartKey && props.onPartMove) {
      props.onPartMove(draggingPartKey, dragPartCurrent.x, dragPartCurrent.y);
      draggingPartKey = null;
      return;
    }

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

  const PART_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#ef4444", "#84cc16"];
  const NET_COLORS = ["#f97316", "#22d3ee", "#a78bfa", "#fb923c", "#34d399", "#f472b6", "#facc15", "#60a5fa"];

  let ratsnestColorMap = $derived.by(() => {
    const map = new Map<string, string>();
    if (!props.ratsnestLines) return map;
    for (const line of props.ratsnestLines) {
      if (!map.has(line.netName)) {
        map.set(line.netName, NET_COLORS[map.size % NET_COLORS.length]);
      }
    }
    return map;
  });

  // Pre-compute strip segments (broken at cuts) for stripboard rendering
  let stripSegments = $derived.by(() => {
    if (props.boardType !== "stripboard") return [];
    const cuts = props.stripCuts ?? [];
    const cutsByRow = new Map<number, number[]>();
    for (const cut of cuts) {
      if (!cutsByRow.has(cut.row)) cutsByRow.set(cut.row, []);
      cutsByRow.get(cut.row)!.push(cut.col);
    }
    for (const cols of cutsByRow.values()) cols.sort((a, b) => a - b);

    const segments: Array<{ row: number; startCol: number; endCol: number }> = [];
    for (let row = 0; row < props.numRows; row++) {
      const rowCuts = cutsByRow.get(row) ?? [];
      let startCol = 0;
      for (const cutCol of rowCuts) {
        if (cutCol >= startCol && cutCol < props.numCols - 1) {
          segments.push({ row, startCol, endCol: cutCol });
          startCol = cutCol + 1;
        }
      }
      segments.push({ row, startCol, endCol: props.numCols - 1 });
    }
    return segments;
  });

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
  onmousemove={handleSvgMouseMove}
  role="application"
  aria-label="Interactive perfboard for component placement"
  style="user-select: none;"
>
  <defs>
    <filter id="pin-shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="#000" flood-opacity="1" />
    </filter>
  </defs>
  <!-- PCB Background -->
  <rect width={svgWidth} height={svgHeight} fill="#152347" />

  <!-- Stripboard copper strips (broken at cuts) -->
  {#if props.boardType === "stripboard"}
    {@const stripHeight = scaledPadRadius * 1.4}
    {#each stripSegments as seg}
      {@const cy = scaledPadding + seg.row * scaledSpacing + scaledSpacing * 0.5}
      {@const startX = scaledPadding + seg.startCol * scaledSpacing + scaledSpacing * 0.5 - scaledPadRadius}
      {@const endX = scaledPadding + seg.endCol * scaledSpacing + scaledSpacing * 0.5 + scaledPadRadius}
      <rect
        x={startX}
        y={cy - stripHeight / 2}
        width={Math.max(0, endX - startX)}
        height={stripHeight}
        fill="#CD7F32"
        fill-opacity="0.85"
        rx={stripHeight * 0.2}
        style="pointer-events: none"
      />
    {/each}
    <!-- Cut marks (thin red lines at break points) -->
    {#if props.stripCuts}
      {#each props.stripCuts as cut}
        {@const cx = scaledPadding + cut.col * scaledSpacing + scaledSpacing}
        {@const cy = scaledPadding + cut.row * scaledSpacing + scaledSpacing * 0.5}
        {@const cutLen = stripHeight * 0.8}
        <line
          x1={cx} y1={cy - cutLen}
          x2={cx} y2={cy + cutLen}
          stroke="#ef4444" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.7" style="pointer-events: none"
        />
      {/each}
    {/if}
  {/if}

  <PerfBoardEdgeLabels
    numRows={props.numRows}
    numCols={props.numCols}
    {scaledPadding}
    {scaledSpacing}
    {scaledPadRadius}
    {svgWidth}
    {svgHeight}
  />

  <!-- Part placement body backgrounds (behind pads) -->
  {#if props.partPlacements}
    {#each props.partPlacements as placement, i}
      {@const isDragTarget = draggingPartKey === placement.partKey}
      {@const isDimmed = draggingPartKey != null && !isDragTarget}
      {@const isFixed = props.fixedPartKeys?.has(placement.partKey) ?? false}
      {@const displayX = isDragTarget ? dragPartCurrent.x : placement.offsetX}
      {@const displayY = isDragTarget ? dragPartCurrent.y : placement.offsetY}
      {@const color = PART_COLORS[i % PART_COLORS.length]}
      {@const bodyX = scaledPadding + displayX * scaledSpacing - scaledSpacing * 0.1}
      {@const bodyY = scaledPadding + displayY * scaledSpacing - scaledSpacing * 0.1}
      {@const bodyW = placement.width * scaledSpacing + scaledSpacing * 0.2}
      {@const bodyH = placement.height * scaledSpacing + scaledSpacing * 0.2}
      <rect
        x={bodyX}
        y={bodyY}
        width={bodyW}
        height={bodyH}
        rx={scaledPadRadius * 0.5}
        fill={color}
        fill-opacity={isDragTarget ? "0.2" : isDimmed ? "0.03" : "0.1"}
        stroke={color}
        stroke-opacity={isDragTarget ? "0.9" : isDimmed ? "0.15" : isFixed ? "0.9" : "0.6"}
        stroke-width={isDragTarget ? "2.5" : isFixed ? "2" : "1.5"}
        stroke-dasharray={isDragTarget || isFixed ? "none" : "4 2"}
        style="pointer-events: none"
      />
    {/each}
  {/if}

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

        {#if props.boardType !== "stripboard"}
          <!-- Copper pad (perfboard only) -->
          <circle
            cx={scaledPadding + colI * scaledSpacing + scaledSpacing * 0.5}
            cy={scaledPadding + rowI * scaledSpacing + scaledSpacing * 0.5}
            r={scaledPadRadius}
            fill={isPinSelected(colI, rowI) ? "#FFD700" : "#CD7F32"}
            stroke={isPinSelected(colI, rowI) ? "#FFA500" : "none"}
            stroke-width={isPinSelected(colI, rowI) ? "2" : "0"}
            style="pointer-events: none; opacity: 1"
          />
        {:else if isPinSelected(colI, rowI)}
          <!-- Pin highlight (stripboard) -->
          <circle
            cx={scaledPadding + colI * scaledSpacing + scaledSpacing * 0.5}
            cy={scaledPadding + rowI * scaledSpacing + scaledSpacing * 0.5}
            r={scaledPadRadius * 0.85}
            fill="#FFD700"
            fill-opacity="0.7"
            style="pointer-events: none"
          />
        {/if}

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
            {@const label = pin.name && pin.name.length <= 3 ? pin.name : pin.pinNumber}
            <text x={centerX} y={centerY} text-anchor="middle" dominant-baseline="central" font-size={Math.max(10, scaledPadRadius * 1.0)} fill="white" font-weight="bold" filter="url(#pin-shadow)" style="pointer-events: none">
              {label}
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
            {@const label = pin.name && pin.name.length <= 3 ? pin.name : pin.pinNumber}
            <circle cx={spot.x} cy={spot.y} r={isLatest ? bubbleRadiusActive : bubbleRadius} fill="#1f2937" opacity="0.9" style="pointer-events: none" />
            <text
              x={spot.x}
              y={spot.y}
              text-anchor="middle"
              dominant-baseline="central"
              font-size={isLatest ? pinFontSizeActive : pinFontSize}
              fill="white"
              font-weight="bold"
              filter="url(#pin-shadow)"
              style="pointer-events: none"
            >
              {label}
            </text>
          {/each}
        {/if}
      {/each}
    {/each}
  </g>

  <!-- Part placement drag targets (on top of pads to capture mousedown) -->
  {#if props.partPlacements && props.onPartMove}
    {#each props.partPlacements as placement, i}
      {@const isDragTarget = draggingPartKey === placement.partKey}
      {@const displayX = isDragTarget ? dragPartCurrent.x : placement.offsetX}
      {@const displayY = isDragTarget ? dragPartCurrent.y : placement.offsetY}
      {@const bodyX = scaledPadding + displayX * scaledSpacing - scaledSpacing * 0.1}
      {@const bodyY = scaledPadding + displayY * scaledSpacing - scaledSpacing * 0.1}
      {@const bodyW = placement.width * scaledSpacing + scaledSpacing * 0.2}
      {@const bodyH = placement.height * scaledSpacing + scaledSpacing * 0.2}
      <rect
        x={bodyX}
        y={bodyY}
        width={bodyW}
        height={bodyH}
        rx={scaledPadRadius * 0.5}
        fill="transparent"
        style="cursor: {isDragTarget ? 'grabbing' : 'grab'}"
        onmousedown={(e) => handlePartMouseDown(e, placement)}
        ondblclick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (props.onUnfixPart) props.onUnfixPart(placement.partKey);
        }}
        oncontextmenu={(e) => {
          e.preventDefault();
          if (props.onPartRotate) props.onPartRotate(placement.partKey);
        }}
      />
    {/each}
  {/if}

  <!-- Part reference labels (rendered last so they're on top) -->
  {#if props.partPlacements}
    {#each props.partPlacements as placement, i}
      {@const isDragTarget = draggingPartKey === placement.partKey}
      {@const isDimmed = draggingPartKey != null && !isDragTarget}
      {@const displayX = isDragTarget ? dragPartCurrent.x : placement.offsetX}
      {@const displayY = isDragTarget ? dragPartCurrent.y : placement.offsetY}
      {@const color = PART_COLORS[i % PART_COLORS.length]}
      {@const bodyX = scaledPadding + displayX * scaledSpacing - scaledSpacing * 0.1}
      {@const bodyW = placement.width * scaledSpacing + scaledSpacing * 0.2}
      {@const labelX = bodyX + bodyW / 2}
      {@const labelY = scaledPadding + displayY * scaledSpacing - scaledSpacing * 0.25}
      {@const fontSize = Math.max(10, scaledPadRadius * 1.0)}
      <!-- Label background pill -->
      <rect
        x={labelX - fontSize * placement.partKey.length * 0.35}
        y={labelY - fontSize * 0.75}
        width={fontSize * placement.partKey.length * 0.7}
        height={fontSize * 1.1}
        rx={fontSize * 0.3}
        fill="#152347"
        fill-opacity={isDimmed ? "0.3" : "0.9"}
        style="pointer-events: none"
      />
      <text
        x={labelX}
        y={labelY}
        text-anchor="middle"
        dominant-baseline="auto"
        font-size={fontSize}
        fill={color}
        font-weight="700"
        style="pointer-events: none; opacity: {isDimmed ? 0.15 : isDragTarget ? 0.7 : 1}"
      >
        {placement.partKey}
      </text>
    {/each}
  {/if}

  <!-- Routed connections: layer 1 = solid traces, layer 2 = dashed jumper wires (back of board) -->
  {#if props.ratsnestLines}
    {@const wiresDimmed = draggingPartKey != null}
    {#each props.ratsnestLines as line}
      {@const color = ratsnestColorMap.get(line.netName) ?? "#888"}
      {@const pts = line.path.map(p => ({ cx: scaledPadding + p.x * scaledSpacing + scaledSpacing * 0.5, cy: scaledPadding + p.y * scaledSpacing + scaledSpacing * 0.5 }))}
      {@const isLayer2 = line.layer === 2}
      {@const isFailed = !!line.failed}
      {@const dotR = isLayer2 ? 5 : 4}
      {@const insetPts = pts.length >= 2 ? (() => {
        const result = pts.map(p => ({ cx: p.cx, cy: p.cy }));
        // Inset first point away from start dot
        const dx0 = result[1].cx - result[0].cx;
        const dy0 = result[1].cy - result[0].cy;
        const d0 = Math.sqrt(dx0 * dx0 + dy0 * dy0);
        if (d0 > dotR) { result[0] = { cx: result[0].cx + dx0 / d0 * dotR, cy: result[0].cy + dy0 / d0 * dotR }; }
        // Inset last point away from end dot
        const last = result.length - 1;
        const dxL = result[last - 1].cx - result[last].cx;
        const dyL = result[last - 1].cy - result[last].cy;
        const dL = Math.sqrt(dxL * dxL + dyL * dyL);
        if (dL > dotR) { result[last] = { cx: result[last].cx + dxL / dL * dotR, cy: result[last].cy + dyL / dL * dotR }; }
        return result;
      })() : pts}
      {@const points = insetPts.map(p => `${p.cx},${p.cy}`).join(" ")}
      <polyline
        {points}
        fill="none"
        stroke={isFailed ? "#ef4444" : color}
        stroke-width={isLayer2 ? 2 : 2.5}
        stroke-opacity={wiresDimmed ? 0.1 : isLayer2 ? 0.7 : 0.8}
        stroke-dasharray={isFailed ? "4 4" : isLayer2 ? "6 3" : ""}
        style="pointer-events: none"
      />
      <!-- Pin dots at endpoints -->
      {#if pts.length >= 2}
        <circle cx={pts[0].cx} cy={pts[0].cy} r={dotR} fill={isFailed ? "#ef4444" : color} fill-opacity={wiresDimmed ? 0.08 : 0.45} style="pointer-events: none" />
        <circle cx={pts[pts.length - 1].cx} cy={pts[pts.length - 1].cy} r={dotR} fill={isFailed ? "#ef4444" : color} fill-opacity={wiresDimmed ? 0.08 : 0.45} style="pointer-events: none" />
      {/if}
    {/each}
  {/if}
</svg>
