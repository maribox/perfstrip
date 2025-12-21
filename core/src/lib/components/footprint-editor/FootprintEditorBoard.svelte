<script lang="ts">
  import PerfBoard from "../PerfBoard.svelte";
  import type { PinPosition } from "xtoedif";
  import type { ComponentBody } from "$lib/types";

  interface Props {
    perfboardCols: number;
    perfboardRows: number;
    selectedPins: PinPosition[];
    componentBodies: ComponentBody[];
    onSetPins: (pins: PinPosition[]) => void;
    onSetBodies: (bodies: ComponentBody[]) => void;
    onColsChange?: (cols: number) => void;
    onRowsChange?: (rows: number) => void;
    handlePadClick: (x: number, y: number) => void;
    handleBodyDrag: (x: number, y: number, width: number, height: number) => void;
    handlePinDrag: (x: number, y: number, width: number, height: number) => void;
  }

  let { 
    perfboardCols = $bindable(),
    perfboardRows = $bindable(),
    selectedPins,
    componentBodies,
    onSetPins,
    onSetBodies,
    onColsChange,
    onRowsChange,
    handlePadClick,
    handleBodyDrag,
    handlePinDrag
  }: Props = $props();

  const MIN_COLS = 5;
  const MAX_COLS = 30;
  const MIN_ROWS = 5;
  const MAX_ROWS = 30;

  const clampValue = (value: number, min: number, max: number) => {
    return Math.min(max, Math.max(min, value));
  };

  const setCols = (value: number) => {
    const next = clampValue(value, MIN_COLS, MAX_COLS);
    if (next !== perfboardCols) {
      perfboardCols = next;
      onColsChange?.(next);
    }
    return next;
  };

  const setRows = (value: number) => {
    const next = clampValue(value, MIN_ROWS, MAX_ROWS);
    if (next !== perfboardRows) {
      perfboardRows = next;
      onRowsChange?.(next);
    }
    return next;
  };

  type ResizeSide = "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  let boardShell: HTMLDivElement | null = null;
  let boardStage: HTMLDivElement | null = null;
  let resizeSide = $state<ResizeSide | null>(null);
  let resizeStart = $state({ x: 0, y: 0, cols: 0, rows: 0, cellW: 0, cellH: 0 });
  let boardBounds = $state({ width: 0, height: 0 });
  let resizePins: PinPosition[] = [];
  let resizeBodies: ComponentBody[] = [];

  const getCellSize = () => {
    const svg = boardShell?.querySelector("svg") as SVGElement | null;
    if (!svg) return { cellW: 0, cellH: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      cellW: rect.width / perfboardCols,
      cellH: rect.height / perfboardRows
    };
  };

  const getShellPadding = () => {
    if (!boardShell) return { padX: 48, padY: 48 };
    const style = getComputedStyle(boardShell);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    return { padX, padY };
  };

  const getStagePadding = () => {
    if (!boardStage) return { padX: 0, padY: 0 };
    const style = getComputedStyle(boardStage);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    return { padX, padY };
  };

  const startResize = (side: ResizeSide, event: PointerEvent) => {
    event.preventDefault();
    const { cellW, cellH } = getCellSize();
    if (!cellW || !cellH) return;
    resizeSide = side;
    resizePins = selectedPins.map(pin => ({ ...pin }));
    resizeBodies = componentBodies.map(body => ({ ...body }));
    resizeStart = {
      x: event.clientX,
      y: event.clientY,
      cols: perfboardCols,
      rows: perfboardRows,
      cellW,
      cellH
    };
    (event.currentTarget as HTMLElement)?.setPointerCapture?.(event.pointerId);
    window.addEventListener("pointermove", handleResizeMove);
    window.addEventListener("pointerup", stopResize);
  };

  const shiftPins = (pins: PinPosition[], deltaX: number, deltaY: number, cols: number, rows: number) => {
    return pins
      .map(pin => ({ ...pin, x: pin.x + deltaX, y: pin.y + deltaY }))
      .filter(pin => pin.x >= 0 && pin.y >= 0 && pin.x < cols && pin.y < rows);
  };

  const shiftBodies = (bodies: ComponentBody[], deltaX: number, deltaY: number, cols: number, rows: number) => {
    return bodies
      .map(body => {
        let x = body.x + deltaX;
        let y = body.y + deltaY;
        let width = body.width;
        let height = body.height;

        if (x < 0) {
          width += x;
          x = 0;
        }
        if (y < 0) {
          height += y;
          y = 0;
        }
        if (x + width > cols) {
          width = cols - x;
        }
        if (y + height > rows) {
          height = rows - y;
        }

        return { x, y, width, height };
      })
      .filter(body => body.width > 0 && body.height > 0 && body.x < cols && body.y < rows);
  };

  const handleResizeMove = (event: PointerEvent) => {
    if (!resizeSide) return;
    const deltaX = event.clientX - resizeStart.x;
    const deltaY = event.clientY - resizeStart.y;

    let nextCols = resizeStart.cols;
    let nextRows = resizeStart.rows;
    let shiftX = 0;
    let shiftY = 0;

    if (resizeSide === "left" || resizeSide === "top-left" || resizeSide === "bottom-left") {
      const steps = Math.round(-deltaX / resizeStart.cellW);
      nextCols = setCols(resizeStart.cols + steps);
      shiftX = nextCols - resizeStart.cols;
    } else if (resizeSide === "right" || resizeSide === "top-right" || resizeSide === "bottom-right") {
      const steps = Math.round(deltaX / resizeStart.cellW);
      nextCols = setCols(resizeStart.cols + steps);
    }

    if (resizeSide === "top" || resizeSide === "top-left" || resizeSide === "top-right") {
      const steps = Math.round(-deltaY / resizeStart.cellH);
      nextRows = setRows(resizeStart.rows + steps);
      shiftY = nextRows - resizeStart.rows;
    } else if (resizeSide === "bottom" || resizeSide === "bottom-left" || resizeSide === "bottom-right") {
      const steps = Math.round(deltaY / resizeStart.cellH);
      nextRows = setRows(resizeStart.rows + steps);
    }

    const nextPins = shiftPins(resizePins, shiftX, shiftY, nextCols, nextRows);
    const nextBodies = shiftBodies(resizeBodies, shiftX, shiftY, nextCols, nextRows);
    onSetPins(nextPins);
    onSetBodies(nextBodies);
  };

  const stopResize = () => {
    resizeSide = null;
    window.removeEventListener("pointermove", handleResizeMove);
    window.removeEventListener("pointerup", stopResize);
  };

  $effect(() => {
    if (!boardStage) return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        const { padX, padY } = getShellPadding();
        const stagePadding = getStagePadding();
        boardBounds = {
          width: Math.max(160, entry.contentRect.width - padX - stagePadding.padX),
          height: Math.max(160, entry.contentRect.height - padY - stagePadding.padY)
        };
      }
    });
    observer.observe(boardStage);
    return () => observer.disconnect();
  });
</script>

<div class="flex flex-col gap-4 flex-1 min-w-0">
  <div class="flex-1 min-h-[720px] flex items-center justify-center">
    <div class="relative w-full h-full flex items-center justify-center p-10" bind:this={boardStage}>
      <div class="relative inline-flex">
        <div
          class="relative rounded-3xl bg-base-200/60 p-6"
          bind:this={boardShell}
        >
          <PerfBoard 
            numCols={perfboardCols} 
            numRows={perfboardRows} 
            placedParts={[]} 
            onPadClick={handlePadClick}
            selectedPins={selectedPins}
            componentBody={componentBodies}
            onBodyDrag={handleBodyDrag}
            onPinDrag={handlePinDrag}
            maxWidth={boardBounds.width || 760}
            maxHeight={boardBounds.height || 760}
            allowScaleUp={true}
            maxScale={Math.min(1.8, 1 + 12 / Math.max(perfboardCols, perfboardRows))}
          />
        </div>

        <div class="absolute inset-0 rounded-3xl border-4 border-primary/70 pointer-events-none"></div>
        <div class="absolute inset-0 rounded-3xl border border-base-300 pointer-events-none"></div>

        <div
          class="absolute inset-x-0 -top-3 h-6 cursor-ns-resize touch-none"
          onpointerdown={(event) => startResize("top", event)}
        ></div>
        <div
          class="absolute inset-x-0 -bottom-3 h-6 cursor-ns-resize touch-none"
          onpointerdown={(event) => startResize("bottom", event)}
        ></div>
        <div
          class="absolute inset-y-0 -left-3 w-6 cursor-ew-resize touch-none"
          onpointerdown={(event) => startResize("left", event)}
        ></div>
        <div
          class="absolute inset-y-0 -right-3 w-6 cursor-ew-resize touch-none"
          onpointerdown={(event) => startResize("right", event)}
        ></div>
        <div
          class="absolute -top-3 -left-3 w-6 h-6 cursor-nwse-resize touch-none"
          onpointerdown={(event) => startResize("top-left", event)}
        ></div>
        <div
          class="absolute -top-3 -right-3 w-6 h-6 cursor-nesw-resize touch-none"
          onpointerdown={(event) => startResize("top-right", event)}
        ></div>
        <div
          class="absolute -bottom-3 -left-3 w-6 h-6 cursor-nesw-resize touch-none"
          onpointerdown={(event) => startResize("bottom-left", event)}
        ></div>
        <div
          class="absolute -bottom-3 -right-3 w-6 h-6 cursor-nwse-resize touch-none"
          onpointerdown={(event) => startResize("bottom-right", event)}
        ></div>
      </div>
    </div>
  </div>
</div>
