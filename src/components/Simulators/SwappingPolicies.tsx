import { useState, useRef, useMemo, useEffect } from "react";
import { Play, Pause, SkipForward, SkipBack, RotateCcw, ArrowRightLeft, HelpCircle } from "lucide-react";
import { cn } from "../../lib/utils";

type Policy = "Optimal" | "FIFO" | "LRU" | "Clock" | "Random";

interface Frame {
  page: number | null;
  useBit: number; // For Clock
  lastUsed: number; // For LRU
  insertedAt: number; // For FIFO
}

export function SwappingPolicies() {
  const [cacheSize, setCacheSize] = useState(3);
  const [refStringStr, setRefStringStr] = useState("0, 1, 2, 0, 1, 3, 0, 3, 1, 2, 1");
  const [policy, setPolicy] = useState<Policy>("FIFO");
  const [speed, setSpeed] = useState(600); // ms per step

  const [isPlaying, setIsPlaying] = useState(false);
  const [step, setStep] = useState(0); // Index in ref string
  const [frames, setFrames] = useState<Frame[]>([]);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [clockHand, setClockHand] = useState(0);
  const [history, setHistory] = useState<any[]>([]);

  const refString = useMemo(() => {
    return refStringStr
      .split(",")
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n));
  }, [refStringStr]);

  const Tm = 100; // Memory access time (ns)
  const Td = 10000000; // Disk access time (ns) - 10ms
  const amat = step > 0 ? Tm + (misses / step) * Td : 0;

  // Initialize frames
  useEffect(() => {
    handleReset();
  }, [cacheSize, policy, refStringStr]);

  const handleReset = () => {
    setFrames(Array(cacheSize).fill({ page: null, useBit: 0, lastUsed: 0, insertedAt: 0 }));
    setStep(0);
    setHits(0);
    setMisses(0);
    setClockHand(0);
    setIsPlaying(false);
    setHistory([]);
  };

  const getOptimalReplaceIndex = (currentFrames: Frame[], currentStep: number) => {
    let farthest = -1;
    let replaceIdx = 0;
    for (let i = 0; i < currentFrames.length; i++) {
      if (currentFrames[i].page === null) return i;
      const nextUse = refString.slice(currentStep + 1).indexOf(currentFrames[i].page!);
      if (nextUse === -1) return i; // Never used again
      if (nextUse > farthest) {
        farthest = nextUse;
        replaceIdx = i;
      }
    }
    return replaceIdx;
  };

  const doStep = () => {
    if (step >= refString.length) {
      setIsPlaying(false);
      return;
    }

    const page = refString[step];
    const newFrames = [...frames];
    let newHits = hits;
    let newMisses = misses;
    let newClockHand = clockHand;

    // Save state for backward step
    setHistory((prev) => [...prev, { frames, hits, misses, clockHand }]);

    const hitIndex = newFrames.findIndex((f) => f.page === page);

    if (hitIndex !== -1) {
      newHits++;
      newFrames[hitIndex] = { ...newFrames[hitIndex], lastUsed: step, useBit: 1 };
    } else {
      newMisses++;
      let replaceIdx = newFrames.findIndex((f) => f.page === null);

      if (replaceIdx === -1) {
        // Cache full, apply policy
        if (policy === "FIFO") {
          let minIns = Infinity;
          newFrames.forEach((f, i) => {
            if (f.insertedAt < minIns) {
              minIns = f.insertedAt;
              replaceIdx = i;
            }
          });
        } else if (policy === "LRU") {
          let minUsed = Infinity;
          newFrames.forEach((f, i) => {
            if (f.lastUsed < minUsed) {
              minUsed = f.lastUsed;
              replaceIdx = i;
            }
          });
        } else if (policy === "Optimal") {
          replaceIdx = getOptimalReplaceIndex(newFrames, step);
        } else if (policy === "Random") {
          replaceIdx = Math.floor(Math.random() * cacheSize);
        } else if (policy === "Clock") {
          while (true) {
            if (newFrames[newClockHand].useBit === 0) {
              replaceIdx = newClockHand;
              newClockHand = (newClockHand + 1) % cacheSize;
              break;
            } else {
              newFrames[newClockHand] = { ...newFrames[newClockHand], useBit: 0 };
              newClockHand = (newClockHand + 1) % cacheSize;
            }
          }
        }
      }

      newFrames[replaceIdx] = { page, useBit: 1, lastUsed: step, insertedAt: step };
    }

    setFrames(newFrames);
    setHits(newHits);
    setMisses(newMisses);
    setClockHand(newClockHand);
    setStep((s) => s + 1);
  };

  const stepBack = () => {
    if (step > 0 && history.length > 0) {
      const prevState = history[history.length - 1];
      setFrames(prevState.frames);
      setHits(prevState.hits);
      setMisses(prevState.misses);
      setClockHand(prevState.clockHand);
      setStep((s) => s - 1);
      setHistory((prev) => prev.slice(0, -1));
    }
  };

  useEffect(() => {
    let interval: any;
    if (isPlaying && step < refString.length) {
      interval = setInterval(() => {
        doStep();
      }, speed);
    } else if (step >= refString.length) {
      setIsPlaying(false);
    }
    return () => clearInterval(interval);
  }, [isPlaying, step, frames, clockHand, speed]);

  const uniquePages = Array.from(new Set(refString));
  const pagesInFrames = new Set(frames.map((f) => f.page).filter((p) => p !== null));
  const swapPages = uniquePages.filter((p) => !pagesInFrames.has(p));

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <ArrowRightLeft className="w-7 h-7 text-indigo-400" />
          Swapping & Cache Replacement Policies
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>OSTEP Chapters 21 & 22</span>
          <span aria-hidden="true">·</span>
          <span>FIFO, LRU, Clock & Optimal Replacement</span>
          <span aria-hidden="true">·</span>
          <span>AMAT (Average Memory Access Time)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Controls Column (4 cols) */}
        <div className="lg:col-span-4 bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-5 overflow-y-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Policy & Workload Config</h3>

          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">Physical RAM Frames (Cache Capacity)</label>
              <input
                type="number"
                min="1"
                max="8"
                value={cacheSize}
                onChange={(e) => setCacheSize(parseInt(e.target.value) || 1)}
                className="bg-[#080C14] border border-[#1F293D] rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500 min-h-[44px]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">Page Reference Access Sequence</label>
              <input
                type="text"
                value={refStringStr}
                onChange={(e) => setRefStringStr(e.target.value)}
                className="bg-[#080C14] border border-[#1F293D] rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500 min-h-[44px]"
              />
              <span className="text-[11px] text-slate-500">Comma-separated virtual page numbers</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">Replacement Policy</label>
              <select
                value={policy}
                onChange={(e) => setPolicy(e.target.value as Policy)}
                className="bg-[#080C14] border border-[#1F293D] rounded-lg px-3 py-2 text-white text-xs font-medium focus:outline-none focus:border-indigo-500 min-h-[44px]"
              >
                <option value="Optimal">Optimal (MIN / Belady's Horizon)</option>
                <option value="FIFO">First-In, First-Out (FIFO)</option>
                <option value="LRU">Least Recently Used (LRU)</option>
                <option value="Clock">Clock (Second Chance with Use Bit)</option>
                <option value="Random">Random Replacement</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 pt-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Playback Step Delay</span>
                <span className="font-mono text-indigo-400">{speed} ms</span>
              </div>
              <input
                type="range"
                min="100"
                max="1200"
                step="50"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>

            {/* Stepping controls */}
            <div className="grid grid-cols-4 gap-2 pt-3 border-t border-[#1F293D]">
              <button
                onClick={stepBack}
                disabled={step === 0 || isPlaying}
                className="bg-[#080C14] hover:bg-slate-800 border border-[#1F293D] disabled:opacity-40 text-slate-200 p-2.5 rounded-lg flex items-center justify-center transition-colors min-h-[44px]"
                title="Step backward"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={step >= refString.length}
                className="col-span-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white p-2.5 rounded-lg flex items-center justify-center gap-2 font-semibold text-xs transition-colors min-h-[44px]"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? "Pause" : "Simulate"}
              </button>
              <button
                onClick={doStep}
                disabled={isPlaying || step >= refString.length}
                className="bg-[#080C14] hover:bg-slate-800 border border-[#1F293D] disabled:opacity-40 text-slate-200 p-2.5 rounded-lg flex items-center justify-center transition-colors min-h-[44px]"
                title="Step forward"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleReset}
              className="w-full bg-[#080C14] hover:bg-slate-800 border border-[#1F293D] text-slate-300 p-2.5 rounded-lg flex items-center justify-center gap-2 font-medium text-xs transition-colors min-h-[44px]"
            >
              <RotateCcw className="w-4 h-4 text-slate-400" /> Reset Simulation
            </button>
          </div>

          <div className="mt-auto pt-4 border-t border-[#1F293D] text-xs text-slate-400 space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-indigo-400">
              <HelpCircle className="w-3.5 h-3.5" />
              Policy Nuances
            </div>
            <p>
              {policy === "Optimal" && "Optimal looks into the future to evict the page accessed furthest in time. Used as the theoretical benchmark."}
              {policy === "FIFO" && "FIFO simply evicts the oldest page. It can suffer from Belady's Anomaly (more frames -> more page faults!)."}
              {policy === "LRU" && "LRU tracks past recency. It respects the Stack Property (no Belady's Anomaly), but requires hardware support or overhead."}
              {policy === "Clock" && "Clock is an efficient $O(1)$ approximation of LRU. A hardware use-bit gives pages a second chance as the clock hand sweeps."}
              {policy === "Random" && "Random picks an eviction victim by uniform chance. Surprisingly resilient against cyclic adversarial access patterns."}
            </p>
          </div>
        </div>

        {/* Visualizer Column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-5 overflow-y-auto">
          {/* Reference String & Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Reference string carousel (7 cols) */}
            <div className="md:col-span-7 bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-3 overflow-x-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Access Stream Progress
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  {step} / {refString.length} accesses
                </span>
              </div>

              <div className="flex gap-2 min-w-max py-2 overflow-x-auto">
                {refString.map((num, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold text-sm transition-all",
                      i === step
                        ? "bg-indigo-600 text-white scale-110 ring-2 ring-indigo-400"
                        : i < step
                        ? "bg-[#080C14] text-slate-400 border border-[#1F293D]"
                        : "bg-[#080C14] text-slate-600 border border-[#1F293D]/50"
                    )}
                  >
                    {num}
                  </div>
                ))}
              </div>
            </div>

            {/* Live Stats Box (5 cols) */}
            <div className="md:col-span-5 bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Cache Performance</h3>
              <div className="grid grid-cols-2 gap-2.5 text-center">
                <div className="bg-[#080C14] border border-[#1F293D] rounded-lg p-2.5">
                  <span className="text-[10px] text-slate-400 block">Hits</span>
                  <span className="text-xl font-bold font-mono text-emerald-400">{hits}</span>
                </div>
                <div className="bg-[#080C14] border border-[#1F293D] rounded-lg p-2.5">
                  <span className="text-[10px] text-slate-400 block">Misses (Faults)</span>
                  <span className="text-xl font-bold font-mono text-rose-400">{misses}</span>
                </div>
                <div className="col-span-2 bg-[#080C14] border border-[#1F293D] rounded-lg p-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block text-left">Hit Rate</span>
                    <span className="text-lg font-bold font-mono text-indigo-400">
                      {step > 0 ? ((hits / step) * 100).toFixed(1) : "0.0"}%
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">AMAT</span>
                    <span className="text-xs font-mono text-slate-300">{(amat / 1000000).toFixed(2)} ms</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Memory Frames & Disk Swap Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 flex-1">
            {/* Physical RAM Frames */}
            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider text-center">
                Physical RAM Page Frames ({cacheSize})
              </h3>

              <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto">
                {frames.map((frame, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all",
                      frame.page !== null
                        ? "bg-indigo-600/10 border-indigo-500/40"
                        : "bg-[#080C14] border-[#1F293D] border-dashed"
                    )}
                  >
                    <span className="w-8 text-center text-xs font-mono text-slate-400">F{i}</span>

                    {policy === "Clock" && (
                      <div className="w-5 flex justify-center">
                        {clockHand === i ? (
                          <span className="text-amber-400 text-xs font-bold">▶</span>
                        ) : null}
                      </div>
                    )}

                    <div
                      className={cn(
                        "flex-1 border rounded-lg h-10 flex items-center justify-center font-mono text-base font-bold",
                        frame.page !== null
                          ? "bg-[#080C14] border-indigo-500/40 text-white"
                          : "bg-[#080C14] border-[#1F293D] text-slate-600"
                      )}
                    >
                      {frame.page !== null ? `Page ${frame.page}` : "— Empty —"}
                    </div>

                    {policy === "Clock" && frame.page !== null && (
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400">Use</span>
                        <span
                          className={cn(
                            "text-xs font-mono font-bold",
                            frame.useBit ? "text-emerald-400" : "text-slate-500"
                          )}
                        >
                          {frame.useBit}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Swap Disk Storage */}
            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider text-center">
                Swap Partition (Backing Store on Disk)
              </h3>

              <div className="flex-1 bg-[#080C14] border border-[#1F293D] rounded-lg p-4 flex flex-wrap gap-2.5 content-start min-h-[140px]">
                {swapPages.length === 0 && (
                  <span className="text-xs text-slate-500 italic w-full text-center mt-8">
                    All accessed pages reside in physical RAM.
                  </span>
                )}
                {swapPages.map((page) => (
                  <div
                    key={page}
                    className="w-16 h-16 bg-[#121826] border border-[#1F293D] rounded-lg flex flex-col items-center justify-center text-slate-400"
                  >
                    <span className="text-[10px] text-slate-500">Page</span>
                    <span className="text-base font-mono font-bold text-white">{page}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
