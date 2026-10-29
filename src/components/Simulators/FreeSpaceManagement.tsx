import { useState, useMemo } from "react";
import { Layers, Plus, Trash2, RotateCcw, HelpCircle, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { cn } from "../../lib/utils";

type Strategy = "First Fit" | "Best Fit" | "Worst Fit" | "Next Fit";

interface MemoryChunk {
  id: string;
  start: number;
  size: number;
  isFree: boolean;
  tag?: string;
  color?: string;
}

const TOTAL_HEAP_SIZE = 1000; // 1000 KB

const CHUNK_COLORS = [
  "#6366F1", // Indigo
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#8B5CF6", // Purple
];

export function FreeSpaceManagement() {
  const [strategy, setStrategy] = useState<Strategy>("First Fit");
  const [allocSize, setAllocSize] = useState<number>(120);
  const [allocTag, setAllocTag] = useState<string>("AppBuffer");
  const [nextFitLastIndex, setNextFitLastIndex] = useState<number>(0);
  const [autoCoalesce, setAutoCoalesce] = useState<boolean>(true);

  // Initial heap layout with some fragmented free blocks
  const [chunks, setChunks] = useState<MemoryChunk[]>([
    { id: "c1", start: 0, size: 200, isFree: false, tag: "OS Kernel Core", color: "#64748B" },
    { id: "c2", start: 200, size: 150, isFree: true },
    { id: "c3", start: 350, size: 100, isFree: false, tag: "Process A", color: CHUNK_COLORS[0] },
    { id: "c4", start: 450, size: 250, isFree: true },
    { id: "c5", start: 700, size: 120, isFree: false, tag: "Process B", color: CHUNK_COLORS[1] },
    { id: "c6", start: 820, size: 180, isFree: true },
  ]);

  const [logs, setLogs] = useState<string[]>([
    "Initialized 1000 KB heap. Free blocks: 150 KB, 250 KB, 180 KB. Total free space: 580 KB.",
  ]);

  const addLog = (msg: string) => setLogs((prev) => [msg, ...prev].slice(0, 10));

  // Compute metrics
  const totalFree = useMemo(() => {
    return chunks.filter((c) => c.isFree).reduce((sum, c) => sum + c.size, 0);
  }, [chunks]);

  const maxContiguousFree = useMemo(() => {
    const freeSizes = chunks.filter((c) => c.isFree).map((c) => c.size);
    return freeSizes.length > 0 ? Math.max(...freeSizes) : 0;
  }, [chunks]);

  const externalFragmentation = useMemo(() => {
    if (totalFree === 0) return 0;
    return ((1 - maxContiguousFree / totalFree) * 100);
  }, [totalFree, maxContiguousFree]);

  // Handle Allocate
  const handleAllocate = () => {
    if (allocSize <= 0) return;

    const freeIndices = chunks
      .map((c, i) => (c.isFree && c.size >= allocSize ? i : -1))
      .filter((i) => i !== -1);

    if (freeIndices.length === 0) {
      if (totalFree >= allocSize) {
        addLog(
          `ALLOCATION FAILED: External fragmentation! Total free memory (${totalFree} KB) >= requested (${allocSize} KB), but no single contiguous block fits!`,
        );
      } else {
        addLog(`ALLOCATION FAILED: Out of memory. Requested ${allocSize} KB, but only ${totalFree} KB free.`);
      }
      return;
    }

    let chosenIndex = -1;

    if (strategy === "First Fit") {
      chosenIndex = freeIndices[0];
    } else if (strategy === "Best Fit") {
      let minDiff = Infinity;
      freeIndices.forEach((idx) => {
        const diff = chunks[idx].size - allocSize;
        if (diff < minDiff) {
          minDiff = diff;
          chosenIndex = idx;
        }
      });
    } else if (strategy === "Worst Fit") {
      let maxDiff = -1;
      freeIndices.forEach((idx) => {
        const diff = chunks[idx].size - allocSize;
        if (diff > maxDiff) {
          maxDiff = diff;
          chosenIndex = idx;
        }
      });
    } else if (strategy === "Next Fit") {
      const wrapped = freeIndices.find((idx) => idx >= nextFitLastIndex) ?? freeIndices[0];
      chosenIndex = wrapped;
      setNextFitLastIndex(chosenIndex);
    }

    const targetChunk = chunks[chosenIndex];
    const remainder = targetChunk.size - allocSize;
    const color = CHUNK_COLORS[Math.floor(Math.random() * CHUNK_COLORS.length)];

    const allocatedChunk: MemoryChunk = {
      id: `alloc-${Date.now()}`,
      start: targetChunk.start,
      size: allocSize,
      isFree: false,
      tag: allocTag || "Allocated",
      color,
    };

    let nextChunks = [...chunks];

    if (remainder > 0) {
      // Split the block
      const remainderChunk: MemoryChunk = {
        id: `free-${Date.now()}`,
        start: targetChunk.start + allocSize,
        size: remainder,
        isFree: true,
      };
      nextChunks.splice(chosenIndex, 1, allocatedChunk, remainderChunk);
      addLog(
        `Allocated ${allocSize} KB at address ${targetChunk.start} using ${strategy}. Carved from ${targetChunk.size} KB block; created ${remainder} KB remainder free block.`,
      );
    } else {
      nextChunks[chosenIndex] = allocatedChunk;
      addLog(`Allocated exact match ${allocSize} KB at address ${targetChunk.start} using ${strategy}.`);
    }

    setChunks(nextChunks);
  };

  // Coalesce adjacent free blocks
  const coalesceChunks = (currentChunks: MemoryChunk[]) => {
    const coalesced: MemoryChunk[] = [];
    for (let i = 0; i < currentChunks.length; i++) {
      const curr = currentChunks[i];
      if (curr.isFree && coalesced.length > 0 && coalesced[coalesced.length - 1].isFree) {
        // Merge with previous
        const prev = coalesced[coalesced.length - 1];
        prev.size += curr.size;
      } else {
        coalesced.push({ ...curr });
      }
    }
    return coalesced;
  };

  // Handle Free
  const handleFree = (id: string) => {
    const chunk = chunks.find((c) => c.id === id);
    if (!chunk || chunk.isFree) return;

    let nextChunks = chunks.map((c) => (c.id === id ? { ...c, isFree: true, tag: undefined, color: undefined } : c));

    if (autoCoalesce) {
      const beforeCount = nextChunks.length;
      nextChunks = coalesceChunks(nextChunks);
      const mergedCount = beforeCount - nextChunks.length;
      addLog(
        `Freed block at address ${chunk.start} (${chunk.size} KB). ${
          mergedCount > 0 ? `Coalesced with ${mergedCount} neighboring free block(s)!` : "No adjacent free blocks to coalesce."
        }`,
      );
    } else {
      addLog(`Freed block at address ${chunk.start} (${chunk.size} KB) without coalescing.`);
    }

    setChunks(nextChunks);
  };

  // Manual Coalesce
  const handleManualCoalesce = () => {
    const beforeCount = chunks.length;
    const nextChunks = coalesceChunks(chunks);
    const merged = beforeCount - nextChunks.length;
    setChunks(nextChunks);
    addLog(`Explicit Coalescing executed: Merged ${merged} adjacent free block boundary(ies).`);
  };

  const handleReset = () => {
    setChunks([
      { id: "c1", start: 0, size: 200, isFree: false, tag: "OS Kernel Core", color: "#64748B" },
      { id: "c2", start: 200, size: 150, isFree: true },
      { id: "c3", start: 350, size: 100, isFree: false, tag: "Process A", color: CHUNK_COLORS[0] },
      { id: "c4", start: 450, size: 250, isFree: true },
      { id: "c5", start: 700, size: 120, isFree: false, tag: "Process B", color: CHUNK_COLORS[1] },
      { id: "c6", start: 820, size: 180, isFree: true },
    ]);
    setLogs(["Reset heap to initial state with 3 free blocks (150 KB, 250 KB, 180 KB)."]);
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <Layers className="w-7 h-7 text-indigo-400" />
          Free-Space Management & Allocation Policies
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>OSTEP Chapter 17</span>
          <span aria-hidden="true">·</span>
          <span>First Fit, Best Fit, Worst Fit & Next Fit</span>
          <span aria-hidden="true">·</span>
          <span>Splitting, Coalescing & External Fragmentation</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Controls Column (4 cols) */}
        <div className="lg:col-span-4 bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-5 overflow-y-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Allocator Policy</h3>

          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">Search Strategy</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as Strategy)}
                className="bg-[#080C14] border border-[#1F293D] rounded-lg px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500 min-h-[44px]"
              >
                <option value="First Fit">First Fit (Fastest, first block that fits)</option>
                <option value="Best Fit">Best Fit (Smallest block that fits, reduces wasted space)</option>
                <option value="Worst Fit">Worst Fit (Largest block that fits, leaves big chunks)</option>
                <option value="Next Fit">Next Fit (Continues search from last allocation)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400">Size (KB)</label>
                <input
                  type="number"
                  min="10"
                  max="500"
                  step="10"
                  value={allocSize}
                  onChange={(e) => setAllocSize(Number(e.target.value))}
                  className="bg-[#080C14] border border-[#1F293D] rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500 min-h-[44px]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400">Tag / Process</label>
                <input
                  type="text"
                  value={allocTag}
                  onChange={(e) => setAllocTag(e.target.value)}
                  className="bg-[#080C14] border border-[#1F293D] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500 min-h-[44px]"
                />
              </div>
            </div>

            <button
              onClick={handleAllocate}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-xs flex items-center justify-center gap-2 min-h-[44px]"
            >
              <Plus className="w-4 h-4" /> Allocate Block ({allocSize} KB)
            </button>

            <div className="pt-3 border-t border-[#1F293D] flex flex-col gap-2.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCoalesce}
                  onChange={(e) => setAutoCoalesce(e.target.checked)}
                  className="rounded bg-[#080C14] border-[#1F293D] accent-indigo-500 w-4 h-4"
                />
                Auto-Coalesce Adjacent Free Blocks on Free
              </label>

              {!autoCoalesce && (
                <button
                  onClick={handleManualCoalesce}
                  className="w-full bg-[#080C14] hover:bg-slate-800 border border-[#1F293D] text-slate-200 py-2 px-3 rounded-lg text-xs font-medium min-h-[40px]"
                >
                  Trigger Manual Coalesce
                </button>
              )}

              <button
                onClick={handleReset}
                className="w-full bg-[#080C14] hover:bg-slate-800 border border-[#1F293D] text-slate-400 hover:text-white py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 min-h-[40px]"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Heap Layout
              </button>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-[#1F293D] text-xs text-slate-400 space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-indigo-400">
              <HelpCircle className="w-3.5 h-3.5" />
              Allocator Mechanics
            </div>
            <p>
              • <b>Splitting:</b> When an allocation request is smaller than a free chunk, the allocator splits it into requested + remainder.<br />
              • <b>Coalescing:</b> Combines adjacent free blocks into one large block to eradicate external fragmentation.<br />
              • <b>Best Fit:</b> Minimizes wasted space per allocation, but creates tiny "splinters".
            </p>
          </div>
        </div>

        {/* Visualizer Column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-5 overflow-y-auto">
          {/* Metrics Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-4 flex flex-col gap-0.5">
              <span className="text-[11px] text-slate-400">Total Free Memory</span>
              <span className="text-xl font-bold font-mono text-emerald-400">{totalFree} KB</span>
              <span className="text-[10px] text-slate-500">{((totalFree / TOTAL_HEAP_SIZE) * 100).toFixed(0)}% of 1000 KB</span>
            </div>

            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-4 flex flex-col gap-0.5">
              <span className="text-[11px] text-slate-400">Max Contiguous Block</span>
              <span className="text-xl font-bold font-mono text-indigo-400">{maxContiguousFree} KB</span>
              <span className="text-[10px] text-slate-500">Largest single allocation</span>
            </div>

            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-4 flex flex-col gap-0.5">
              <span className="text-[11px] text-slate-400">External Fragmentation</span>
              <span className={cn("text-xl font-bold font-mono", externalFragmentation > 30 ? "text-amber-400" : "text-slate-200")}>
                {externalFragmentation.toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-500">1 - (MaxBlock / TotalFree)</span>
            </div>

            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-4 flex flex-col gap-0.5">
              <span className="text-[11px] text-slate-400">Free Blocks Count</span>
              <span className="text-xl font-bold font-mono text-white">{chunks.filter((c) => c.isFree).length}</span>
              <span className="text-[10px] text-slate-500">{chunks.length} total blocks</span>
            </div>
          </div>

          {/* Heap Memory Map Bar */}
          <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Physical Heap Memory Map (0 – 1000 KB)
              </h3>
              <span className="text-xs font-mono text-slate-400">Total: 1000 KB</span>
            </div>

            <div className="w-full h-14 rounded-lg border border-[#1F293D] bg-[#080C14] flex overflow-hidden">
              {chunks.map((chunk) => {
                const widthPct = (chunk.size / TOTAL_HEAP_SIZE) * 100;

                return (
                  <div
                    key={chunk.id}
                    className={cn(
                      "h-full flex flex-col items-center justify-center border-r border-[#090D16]/40 px-1 text-center transition-all",
                      chunk.isFree
                        ? "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                        : "text-white hover:brightness-110"
                    )}
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: chunk.isFree ? undefined : chunk.color,
                    }}
                    title={`${chunk.isFree ? "Free Block" : chunk.tag}: ${chunk.size} KB (${chunk.start}..${chunk.start + chunk.size})`}
                  >
                    <span className="text-[10px] font-mono font-bold truncate max-w-full">
                      {chunk.size} KB
                    </span>
                    <span className="text-[9px] font-sans truncate max-w-full opacity-80">
                      {chunk.isFree ? "Free" : chunk.tag}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-1">
              <span>0 KB</span>
              <span>250 KB</span>
              <span>500 KB</span>
              <span>750 KB</span>
              <span>1000 KB</span>
            </div>
          </div>

          {/* Chunks List Table */}
          <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Free-List & Allocated Chunks
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1F293D] text-slate-400">
                    <th className="py-2 font-medium">Range [Start..End]</th>
                    <th className="py-2 font-medium">Size</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Owner Tag</th>
                    <th className="py-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F293D]/60 font-mono">
                  {chunks.map((chunk) => (
                    <tr key={chunk.id} className="hover:bg-slate-900/30">
                      <td className="py-2 text-slate-300">
                        {chunk.start} .. {chunk.start + chunk.size} KB
                      </td>
                      <td className="py-2 text-white font-bold">{chunk.size} KB</td>
                      <td className="py-2">
                        {chunk.isFree ? (
                          <span className="text-emerald-400 font-semibold">FREE</span>
                        ) : (
                          <span className="text-indigo-400 font-semibold">ALLOCATED</span>
                        )}
                      </td>
                      <td className="py-2 text-slate-300 font-sans">{chunk.tag || "—"}</td>
                      <td className="py-2 text-right">
                        {!chunk.isFree && chunk.tag !== "OS Kernel Core" ? (
                          <button
                            onClick={() => handleFree(chunk.id)}
                            className="text-slate-400 hover:text-rose-400 font-sans text-xs underline p-1"
                          >
                            free()
                          </button>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Allocator Trace Log */}
          <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-2 min-h-[160px]">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Memory Allocator Event Trace
            </h3>
            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-40 font-mono text-xs pr-1">
              {logs.map((log, idx) => (
                <div key={idx} className="p-2 rounded bg-[#080C14] border border-[#1F293D] text-slate-300">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
