import { useState, useMemo } from "react";
import { Disc, Play, RotateCcw, HelpCircle, StepForward, BarChart3, ArrowRight } from "lucide-react";
import { cn } from "../../lib/utils";

type DiskAlgorithm = "FCFS" | "SSTF" | "SCAN" | "C-SCAN" | "LOOK" | "C-LOOK";

const TOTAL_CYLINDERS = 200; // 0 to 199

export function DiskScheduling() {
  const [algorithm, setAlgorithm] = useState<DiskAlgorithm>("SSTF");
  const [initialHead, setInitialHead] = useState<number>(53);
  const [direction, setDirection] = useState<"UP" | "DOWN">("UP");
  const [requestQueueStr, setRequestQueueStr] = useState<string>("98, 183, 37, 122, 14, 124, 65, 67");
  const [currentStep, setCurrentStep] = useState<number>(0);

  const requestQueue = useMemo(() => {
    return requestQueueStr
      .split(",")
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n) && n >= 0 && n < TOTAL_CYLINDERS);
  }, [requestQueueStr]);

  // Compute head movement path for chosen algorithm
  const schedulePath = useMemo(() => {
    if (requestQueue.length === 0) return [initialHead];

    const path: number[] = [initialHead];
    let pending = [...requestQueue];
    let curr = initialHead;
    let currDir = direction;

    if (algorithm === "FCFS") {
      pending.forEach((track) => path.push(track));
    } else if (algorithm === "SSTF") {
      while (pending.length > 0) {
        let closestIdx = 0;
        let minDist = Math.abs(pending[0] - curr);
        for (let i = 1; i < pending.length; i++) {
          const dist = Math.abs(pending[i] - curr);
          if (dist < minDist) {
            minDist = dist;
            closestIdx = i;
          }
        }
        curr = pending[closestIdx];
        path.push(curr);
        pending.splice(closestIdx, 1);
      }
    } else if (algorithm === "SCAN") {
      // Moves towards boundary (199 or 0), reverses
      if (currDir === "UP") {
        const upper = pending.filter((t) => t >= curr).sort((a, b) => a - b);
        const lower = pending.filter((t) => t < curr).sort((a, b) => b - a);
        upper.forEach((t) => path.push(t));
        if (upper.length > 0 && upper[upper.length - 1] !== TOTAL_CYLINDERS - 1 && lower.length > 0) {
          path.push(TOTAL_CYLINDERS - 1);
        }
        lower.forEach((t) => path.push(t));
      } else {
        const lower = pending.filter((t) => t <= curr).sort((a, b) => b - a);
        const upper = pending.filter((t) => t > curr).sort((a, b) => a - b);
        lower.forEach((t) => path.push(t));
        if (lower.length > 0 && lower[lower.length - 1] !== 0 && upper.length > 0) {
          path.push(0);
        }
        upper.forEach((t) => path.push(t));
      }
    } else if (algorithm === "C-SCAN") {
      // Moves in one direction, jumps back to start without serving on return
      if (currDir === "UP") {
        const upper = pending.filter((t) => t >= curr).sort((a, b) => a - b);
        const lower = pending.filter((t) => t < curr).sort((a, b) => a - b);
        upper.forEach((t) => path.push(t));
        if (lower.length > 0) {
          path.push(TOTAL_CYLINDERS - 1);
          path.push(0);
          lower.forEach((t) => path.push(t));
        }
      } else {
        const lower = pending.filter((t) => t <= curr).sort((a, b) => b - a);
        const upper = pending.filter((t) => t > curr).sort((a, b) => b - a);
        lower.forEach((t) => path.push(t));
        if (upper.length > 0) {
          path.push(0);
          path.push(TOTAL_CYLINDERS - 1);
          upper.forEach((t) => path.push(t));
        }
      }
    } else if (algorithm === "LOOK") {
      // Like SCAN, but only goes as far as final request in current direction
      if (currDir === "UP") {
        const upper = pending.filter((t) => t >= curr).sort((a, b) => a - b);
        const lower = pending.filter((t) => t < curr).sort((a, b) => b - a);
        upper.forEach((t) => path.push(t));
        lower.forEach((t) => path.push(t));
      } else {
        const lower = pending.filter((t) => t <= curr).sort((a, b) => b - a);
        const upper = pending.filter((t) => t > curr).sort((a, b) => a - b);
        lower.forEach((t) => path.push(t));
        upper.forEach((t) => path.push(t));
      }
    } else if (algorithm === "C-LOOK") {
      if (currDir === "UP") {
        const upper = pending.filter((t) => t >= curr).sort((a, b) => a - b);
        const lower = pending.filter((t) => t < curr).sort((a, b) => a - b);
        upper.forEach((t) => path.push(t));
        lower.forEach((t) => path.push(t));
      } else {
        const lower = pending.filter((t) => t <= curr).sort((a, b) => b - a);
        const upper = pending.filter((t) => t > curr).sort((a, b) => b - a);
        lower.forEach((t) => path.push(t));
        upper.forEach((t) => path.push(t));
      }
    }

    return path;
  }, [algorithm, initialHead, direction, requestQueue]);

  // Total seek head movement
  const totalHeadMovement = useMemo(() => {
    let movement = 0;
    for (let i = 1; i < schedulePath.length; i++) {
      movement += Math.abs(schedulePath[i] - schedulePath[i - 1]);
    }
    return movement;
  }, [schedulePath]);

  const activePath = schedulePath.slice(0, currentStep + 1);
  const activePosition = schedulePath[currentStep] ?? initialHead;

  const handleStep = () => {
    setCurrentStep((prev) => Math.min(prev + 1, schedulePath.length - 1));
  };

  const handleReset = () => {
    setCurrentStep(0);
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <Disc className="w-7 h-7 text-indigo-400" />
          Hard Disk Arm Scheduling Simulator
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>OSTEP Chapter 37</span>
          <span aria-hidden="true">·</span>
          <span>FCFS, SSTF, SCAN (Elevator), C-SCAN, LOOK & C-LOOK</span>
          <span aria-hidden="true">·</span>
          <span>Cylinder Seek Optimization & Head Movement Distance</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Controls Column (4 cols) */}
        <div className="lg:col-span-4 bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-5 overflow-y-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Disk Controller Setup</h3>

          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">Scheduling Algorithm</label>
              <select
                value={algorithm}
                onChange={(e) => {
                  setAlgorithm(e.target.value as DiskAlgorithm);
                  handleReset();
                }}
                className="bg-[#080C14] border border-[#1F293D] rounded-lg px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500 min-h-[44px]"
              >
                <option value="FCFS">FCFS (First-Come, First-Served)</option>
                <option value="SSTF">SSTF (Shortest Seek Time First)</option>
                <option value="SCAN">SCAN (Elevator Algorithm to Boundary)</option>
                <option value="C-SCAN">C-SCAN (Circular SCAN)</option>
                <option value="LOOK">LOOK (Elevator to Last Request)</option>
                <option value="C-LOOK">C-LOOK (Circular LOOK)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400">Initial Head (0–199)</label>
                <input
                  type="number"
                  min="0"
                  max="199"
                  value={initialHead}
                  onChange={(e) => {
                    setInitialHead(Math.min(199, Math.max(0, Number(e.target.value))));
                    handleReset();
                  }}
                  className="bg-[#080C14] border border-[#1F293D] rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500 min-h-[44px]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400">Arm Direction</label>
                <select
                  value={direction}
                  onChange={(e) => {
                    setDirection(e.target.value as "UP" | "DOWN");
                    handleReset();
                  }}
                  className="bg-[#080C14] border border-[#1F293D] rounded-lg px-3 py-2 text-white text-xs font-medium focus:outline-none focus:border-indigo-500 min-h-[44px]"
                >
                  <option value="UP">Up (towards 199)</option>
                  <option value="DOWN">Down (towards 0)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">Track Request Queue (Cylinders)</label>
              <input
                type="text"
                value={requestQueueStr}
                onChange={(e) => {
                  setRequestQueueStr(e.target.value);
                  handleReset();
                }}
                className="bg-[#080C14] border border-[#1F293D] rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500 min-h-[44px]"
              />
              <span className="text-[11px] text-slate-500">Standard OSTEP textbook workload</span>
            </div>

            <div className="pt-3 border-t border-[#1F293D] flex items-center gap-2.5">
              <button
                onClick={handleStep}
                disabled={currentStep >= schedulePath.length - 1}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-xs flex items-center justify-center gap-2 min-h-[44px]"
              >
                <StepForward className="w-4 h-4" />
                Step Seek ({currentStep}/{schedulePath.length - 1})
              </button>

              <button
                onClick={handleReset}
                className="bg-[#080C14] hover:bg-slate-800 border border-[#1F293D] text-slate-300 py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center min-h-[44px]"
                title="Reset simulation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-[#1F293D] text-xs text-slate-400 space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-indigo-400">
              <HelpCircle className="w-3.5 h-3.5" />
              Scheduling Insights
            </div>
            <p>
              • <b>SSTF:</b> Greedy algorithm choosing the nearest track. Prone to starvation for requests far from the head cluster.<br />
              • <b>SCAN (Elevator):</b> Sweeps continuously across tracks in one direction, then reverses, avoiding starvation.<br />
              • <b>C-SCAN:</b> Only serves in one direction, providing much more uniform waiting time distribution across inner and outer cylinders.
            </p>
          </div>
        </div>

        {/* Visualizer Column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-5 overflow-y-auto">
          {/* Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-4 flex flex-col gap-0.5">
              <span className="text-[11px] text-slate-400">Total Head Movement</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-white">
                {totalHeadMovement} <span className="text-xs text-slate-400 font-normal">tracks</span>
              </span>
              <span className="text-[10px] text-slate-500">Lower is better</span>
            </div>

            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-4 flex flex-col gap-0.5">
              <span className="text-[11px] text-slate-400">Current Track</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-indigo-400">
                {activePosition} <span className="text-xs text-slate-400 font-normal">/ 199</span>
              </span>
              <span className="text-[10px] text-slate-500">Initial: {initialHead}</span>
            </div>

            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-4 flex flex-col gap-0.5">
              <span className="text-[11px] text-slate-400">Requests Pending</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-amber-400">
                {Math.max(0, schedulePath.length - 1 - currentStep)}
              </span>
              <span className="text-[10px] text-slate-500">{requestQueue.length} total</span>
            </div>

            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-4 flex flex-col gap-0.5">
              <span className="text-[11px] text-slate-400">Avg Seek Distance</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
                {requestQueue.length > 0 ? (totalHeadMovement / requestQueue.length).toFixed(1) : 0}
              </span>
              <span className="text-[10px] text-slate-500">Cylinders per I/O</span>
            </div>
          </div>

          {/* Cylinder Track Bar Visualizer */}
          <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Disk Platter Cylinder Track Position (0 – 199)
            </h3>

            <div className="relative w-full h-16 bg-[#080C14] border border-[#1F293D] rounded-lg p-2">
              {/* Request target pins */}
              {requestQueue.map((req, idx) => {
                const isVisited = activePath.includes(req);

                return (
                  <div
                    key={idx}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                    style={{ left: `${(req / (TOTAL_CYLINDERS - 1)) * 96 + 2}%` }}
                    title={`Request for cylinder ${req}`}
                  >
                    <span
                      className={cn(
                        "w-2.5 h-2.5 rounded-full transition-all",
                        isVisited ? "bg-emerald-400 ring-2 ring-emerald-400/40" : "bg-indigo-400/70"
                      )}
                    />
                    <span className="text-[9px] font-mono text-slate-400 mt-1">{req}</span>
                  </div>
                );
              })}

              {/* Disk Head Arm Marker */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 transition-all duration-300 flex flex-col items-center pointer-events-none"
                style={{ left: `${(activePosition / (TOTAL_CYLINDERS - 1)) * 96 + 2}%` }}
              >
                <div className="w-1 h-12 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.9)]" />
                <span className="absolute -top-5 text-[10px] font-mono font-bold text-white bg-indigo-600 px-1.5 py-0.5 rounded shadow">
                  Head: {activePosition}
                </span>
              </div>
            </div>

            <div className="flex justify-between text-[11px] font-mono text-slate-500 px-1">
              <span>Track 0 (Inner)</span>
              <span>Track 50</span>
              <span>Track 100</span>
              <span>Track 150</span>
              <span>Track 199 (Outer)</span>
            </div>
          </div>

          {/* Execution Sequence & Seek Hop Table */}
          <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              Arm Traversal Sequence ({schedulePath.length} Hops)
            </h3>

            <div className="flex flex-wrap gap-2 items-center font-mono text-xs">
              {schedulePath.map((track, i) => {
                const isReached = i <= currentStep;
                const isCurrent = i === currentStep;

                return (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all",
                        isCurrent
                          ? "bg-indigo-600 text-white ring-2 ring-indigo-400 shadow-md"
                          : isReached
                          ? "bg-[#080C14] border-emerald-500/50 text-emerald-300"
                          : "bg-[#080C14] border-[#1F293D] text-slate-500"
                      )}
                    >
                      {i === 0 ? `Start: ${track}` : track}
                    </div>
                    {i < schedulePath.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
