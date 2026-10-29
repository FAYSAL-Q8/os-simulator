import { useState, useMemo, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, StepForward, Plus, Trash2, Cpu, Clock, BarChart3, HelpCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export type Algorithm = "FIFO" | "SJF" | "STCF" | "RR" | "MLFQ";

export interface Process {
  id: string;
  name: string;
  arrival: number;
  burst: number;
  color: string;
}

const PRESET_COLORS = [
  "#6366F1", // Indigo
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#8B5CF6", // Purple
];

const PRESETS: { name: string; algorithm: Algorithm; quantum?: number; processes: Process[] }[] = [
  {
    name: "Convoy Effect (FIFO Bottleneck)",
    algorithm: "FIFO",
    processes: [
      { id: "p1", name: "Job A (Heavy)", arrival: 0, burst: 12, color: PRESET_COLORS[0] },
      { id: "p2", name: "Job B (Quick)", arrival: 1, burst: 2, color: PRESET_COLORS[1] },
      { id: "p3", name: "Job C (Quick)", arrival: 2, burst: 2, color: PRESET_COLORS[2] },
    ],
  },
  {
    name: "STCF Preemption",
    algorithm: "STCF",
    processes: [
      { id: "p1", name: "Job A", arrival: 0, burst: 10, color: PRESET_COLORS[0] },
      { id: "p2", name: "Job B", arrival: 2, burst: 3, color: PRESET_COLORS[1] },
      { id: "p3", name: "Job C", arrival: 4, burst: 1, color: PRESET_COLORS[2] },
    ],
  },
  {
    name: "Round Robin Fairness",
    algorithm: "RR",
    quantum: 2,
    processes: [
      { id: "p1", name: "Job A", arrival: 0, burst: 6, color: PRESET_COLORS[0] },
      { id: "p2", name: "Job B", arrival: 0, burst: 6, color: PRESET_COLORS[1] },
      { id: "p3", name: "Job C", arrival: 0, burst: 6, color: PRESET_COLORS[2] },
    ],
  },
  {
    name: "MLFQ Multi-Level Queues",
    algorithm: "MLFQ",
    processes: [
      { id: "p1", name: "Job Long (CPU)", arrival: 0, burst: 14, color: PRESET_COLORS[0] },
      { id: "p2", name: "Job Short (Interactive)", arrival: 3, burst: 3, color: PRESET_COLORS[1] },
      { id: "p3", name: "Job Medium", arrival: 6, burst: 5, color: PRESET_COLORS[2] },
    ],
  },
];

interface ExecutionSlice {
  time: number;
  processId: string | null;
  processName: string;
  color: string;
}

export function CPUScheduling() {
  const [algorithm, setAlgorithm] = useState<Algorithm>("RR");
  const [quantum, setQuantum] = useState(2);
  const [speed, setSpeed] = useState(500); // ms per step
  const [processes, setProcesses] = useState<Process[]>(PRESETS[2].processes);

  // Simulation execution state
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // New process input states
  const [newArrival, setNewArrival] = useState(0);
  const [newBurst, setNewBurst] = useState(4);

  // Compute full schedule timeline deterministically
  const scheduleResult = useMemo(() => {
    if (processes.length === 0) {
      return { timeline: [], maxTime: 0, metrics: {}, queueSnapshots: [] };
    }

    const totalBurst = processes.reduce((acc, p) => acc + p.burst, 0);
    const maxArrival = Math.max(...processes.map((p) => p.arrival));
    const maxSimulationTime = Math.max(30, totalBurst + maxArrival + 5);

    const timeline: ExecutionSlice[] = [];
    const remainingTime: Record<string, number> = {};
    const firstRunTime: Record<string, number> = {};
    const completionTime: Record<string, number> = {};
    const queueLevel: Record<string, number> = {}; // for MLFQ (2 = highest, 1 = mid, 0 = lowest)
    const timeInLevel: Record<string, number> = {}; // for MLFQ allotment
    const readyQueue: string[] = []; // for RR
    let lastRunningProcess: string | null = null;
    let currentSliceSpent = 0;

    processes.forEach((p) => {
      remainingTime[p.id] = p.burst;
      queueLevel[p.id] = 2; // highest priority by default
      timeInLevel[p.id] = 0;
    });

    const mlfqPriorityBoostPeriod = 16;
    const mlfqAllotment = [8, 4, 2]; // Allotment for Q0, Q1, Q2

    // Step cycle by cycle
    for (let t = 0; t < maxSimulationTime; t++) {
      // Check if all finished
      const allDone = processes.every((p) => remainingTime[p.id] === 0);
      if (allDone && t > 0) break;

      // MLFQ Priority Boost: periodically reset all processes to top queue
      if (algorithm === "MLFQ" && t > 0 && t % mlfqPriorityBoostPeriod === 0) {
        processes.forEach((p) => {
          if (remainingTime[p.id] > 0) {
            queueLevel[p.id] = 2;
            timeInLevel[p.id] = 0;
          }
        });
      }

      // Check new arrivals at time t
      const arriving = processes.filter((p) => p.arrival === t);
      if (algorithm === "RR") {
        arriving.forEach((p) => {
          if (!readyQueue.includes(p.id)) readyQueue.push(p.id);
        });
      }

      // Available active candidates
      const available = processes.filter((p) => p.arrival <= t && remainingTime[p.id] > 0);

      let selectedId: string | null = null;

      if (available.length > 0) {
        if (algorithm === "FIFO") {
          // Earliest arrival, tie-break by ID
          available.sort((a, b) => a.arrival - b.arrival);
          // If a process was running and still has burst, keep running
          if (lastRunningProcess && remainingTime[lastRunningProcess] > 0) {
            selectedId = lastRunningProcess;
          } else {
            selectedId = available[0].id;
          }
        } else if (algorithm === "SJF") {
          // Non-preemptive shortest job first
          if (lastRunningProcess && remainingTime[lastRunningProcess] > 0) {
            selectedId = lastRunningProcess;
          } else {
            available.sort((a, b) => a.burst - b.burst || a.arrival - b.arrival);
            selectedId = available[0].id;
          }
        } else if (algorithm === "STCF") {
          // Preemptive shortest time-to-completion first
          available.sort((a, b) => remainingTime[a.id] - remainingTime[b.id] || a.arrival - b.arrival);
          selectedId = available[0].id;
        } else if (algorithm === "RR") {
          // Round Robin with quantum
          if (lastRunningProcess && remainingTime[lastRunningProcess] > 0) {
            if (currentSliceSpent < quantum) {
              selectedId = lastRunningProcess;
            } else {
              // Quantum expired, rotate to back of queue
              const idx = readyQueue.indexOf(lastRunningProcess);
              if (idx !== -1) readyQueue.splice(idx, 1);
              readyQueue.push(lastRunningProcess);

              // Pick next valid candidate from readyQueue
              const nextValid = readyQueue.find((id) => remainingTime[id] > 0);
              selectedId = nextValid || null;
              currentSliceSpent = 0;
            }
          } else {
            // Last process completed or was idle
            const nextValid = readyQueue.find((id) => remainingTime[id] > 0);
            selectedId = nextValid || null;
            currentSliceSpent = 0;
          }
        } else if (algorithm === "MLFQ") {
          // Multi-Level Feedback Queue (Queues 2, 1, 0)
          // Find the highest non-empty priority level
          let chosen: Process | null = null;
          for (let q = 2; q >= 0; q--) {
            const inLevel = available.filter((p) => queueLevel[p.id] === q);
            if (inLevel.length > 0) {
              // Round-robin or FIFO within same level
              if (lastRunningProcess && inLevel.some((p) => p.id === lastRunningProcess)) {
                chosen = inLevel.find((p) => p.id === lastRunningProcess)!;
              } else {
                chosen = inLevel[0];
              }
              break;
            }
          }

          if (chosen) {
            selectedId = chosen.id;
          }
        }
      }

      if (selectedId) {
        if (!(selectedId in firstRunTime)) {
          firstRunTime[selectedId] = t;
        }

        const proc = processes.find((p) => p.id === selectedId)!;
        timeline.push({
          time: t,
          processId: selectedId,
          processName: proc.name,
          color: proc.color,
        });

        remainingTime[selectedId] -= 1;
        currentSliceSpent = selectedId === lastRunningProcess ? currentSliceSpent + 1 : 1;

        if (algorithm === "MLFQ") {
          timeInLevel[selectedId] += 1;
          const currentLvl = queueLevel[selectedId];
          const allotmentLimit = mlfqAllotment[currentLvl];

          // If consumed allotment at current level, demote one level
          if (timeInLevel[selectedId] >= allotmentLimit && currentLvl > 0) {
            queueLevel[selectedId] = currentLvl - 1;
            timeInLevel[selectedId] = 0;
          }
        }

        if (remainingTime[selectedId] === 0) {
          completionTime[selectedId] = t + 1;
          if (algorithm === "RR") {
            const idx = readyQueue.indexOf(selectedId);
            if (idx !== -1) readyQueue.splice(idx, 1);
          }
        }

        lastRunningProcess = selectedId;
      } else {
        timeline.push({
          time: t,
          processId: null,
          processName: "Idle",
          color: "#1E2638",
        });
        lastRunningProcess = null;
        currentSliceSpent = 0;
      }
    }

    // Calculate metrics
    const processMetrics = processes.map((p) => {
      const completion = completionTime[p.id] ?? maxSimulationTime;
      const firstRun = firstRunTime[p.id] ?? p.arrival;
      const turnaround = completion - p.arrival;
      const response = firstRun - p.arrival;
      const wait = turnaround - p.burst;
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        arrival: p.arrival,
        burst: p.burst,
        completion,
        turnaround: Math.max(0, turnaround),
        response: Math.max(0, response),
        wait: Math.max(0, wait),
      };
    });

    const avgTurnaround =
      processMetrics.length > 0
        ? processMetrics.reduce((acc, m) => acc + m.turnaround, 0) / processMetrics.length
        : 0;

    const avgResponse =
      processMetrics.length > 0
        ? processMetrics.reduce((acc, m) => acc + m.response, 0) / processMetrics.length
        : 0;

    const avgWait =
      processMetrics.length > 0
        ? processMetrics.reduce((acc, m) => acc + m.wait, 0) / processMetrics.length
        : 0;

    const busySlices = timeline.filter((slice) => slice.processId !== null).length;
    const cpuUtilization = timeline.length > 0 ? (busySlices / timeline.length) * 100 : 0;

    return {
      timeline,
      maxTime: timeline.length,
      processMetrics,
      avgTurnaround,
      avgResponse,
      avgWait,
      cpuUtilization,
    };
  }, [processes, algorithm, quantum]);

  // Auto-play timer
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = window.setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= scheduleResult.timeline.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, speed);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speed, scheduleResult.timeline.length]);

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleStep = () => {
    setIsPlaying(false);
    setCurrentTime((prev) => Math.min(prev + 1, scheduleResult.timeline.length - 1));
  };

  const handleAddProcess = () => {
    if (processes.length >= 8) return;
    const nextIndex = processes.length + 1;
    const color = PRESET_COLORS[(nextIndex - 1) % PRESET_COLORS.length];
    const newProc: Process = {
      id: `p${Date.now()}`,
      name: `Job ${String.fromCharCode(64 + nextIndex)}`,
      arrival: Math.max(0, newArrival),
      burst: Math.max(1, newBurst),
      color,
    };
    setProcesses([...processes, newProc]);
    handleReset();
  };

  const handleRemoveProcess = (id: string) => {
    if (processes.length <= 1) return;
    setProcesses(processes.filter((p) => p.id !== id));
    handleReset();
  };

  const loadPreset = (preset: typeof PRESETS[0]) => {
    setAlgorithm(preset.algorithm);
    if (preset.quantum) setQuantum(preset.quantum);
    setProcesses(preset.processes);
    handleReset();
  };

  // Slices up to current time
  const visibleTimeline = scheduleResult.timeline.slice(0, currentTime + 1);
  const currentSlice = scheduleResult.timeline[currentTime] || null;

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <Cpu className="w-7 h-7 text-indigo-400" />
          CPU Scheduling Simulator
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>OSTEP Chapters 7, 8 & 9</span>
          <span aria-hidden="true">·</span>
          <span>Virtualizing the CPU</span>
          <span aria-hidden="true">·</span>
          <span>FIFO, SJF, STCF, Round Robin & MLFQ</span>
        </div>
      </div>

      {/* Main Grid: Controls + Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left Column: Configuration & Process Manager (4 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5 overflow-y-auto">
          {/* Preset Buttons */}
          <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-3">
            <label className="text-xs font-semibold text-slate-300">Preset Scenarios</label>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => loadPreset(preset)}
                  className="px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-[#090D16] hover:bg-slate-800 border border-[#1F293D] rounded-lg transition-colors text-left truncate"
                  title={preset.name}
                >
                  {preset.name.split(" ")[0]} ({preset.algorithm})
                </button>
              ))}
            </div>
          </div>

          {/* Algorithm Controls */}
          <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Scheduler Configuration</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400">Scheduling Algorithm</label>
                <select
                  value={algorithm}
                  onChange={(e) => {
                    setAlgorithm(e.target.value as Algorithm);
                    handleReset();
                  }}
                  className="bg-[#080C14] border border-[#1F293D] text-white rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500 min-h-[44px]"
                >
                  <option value="FIFO">FIFO (First-In, First-Out)</option>
                  <option value="SJF">SJF (Shortest Job First)</option>
                  <option value="STCF">STCF (Preemptive SJF)</option>
                  <option value="RR">Round Robin (RR)</option>
                  <option value="MLFQ">MLFQ (Multi-Level Feedback)</option>
                </select>
              </div>

              {algorithm === "RR" ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Time Quantum (Q)</span>
                    <span className="font-mono text-indigo-400">{quantum} cycles</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="6"
                    step="1"
                    value={quantum}
                    onChange={(e) => {
                      setQuantum(Number(e.target.value));
                      handleReset();
                    }}
                    className="w-full accent-indigo-500 mt-2"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 justify-center">
                  <span className="text-xs text-slate-400">Policy Characteristic</span>
                  <span className="text-xs text-slate-300">
                    {algorithm === "FIFO" && "Non-preemptive, arrival order"}
                    {algorithm === "SJF" && "Non-preemptive, shortest burst first"}
                    {algorithm === "STCF" && "Preemptive, lowest remaining work"}
                    {algorithm === "MLFQ" && "3-level feedback with priority boost"}
                  </span>
                </div>
              )}
            </div>

            {/* Playback Controls */}
            <div className="pt-3 border-t border-[#1F293D] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all min-h-[40px]"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isPlaying ? "Pause" : "Simulate"}
                </button>
                <button
                  onClick={handleStep}
                  disabled={isPlaying || currentTime >= scheduleResult.timeline.length - 1}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#090D16] border border-[#1F293D] hover:bg-slate-800 text-slate-300 text-xs font-medium disabled:opacity-40 min-h-[40px]"
                >
                  <StepForward className="w-4 h-4" />
                  Step
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#090D16] border border-[#1F293D] hover:bg-slate-800 text-slate-300 text-xs font-medium min-h-[40px]"
                  title="Reset Timeline"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Speed:</span>
                <select
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="bg-[#080C14] border border-[#1F293D] text-slate-300 rounded px-2 py-1 text-xs"
                >
                  <option value={800}>0.5x</option>
                  <option value={400}>1.0x</option>
                  <option value={150}>2.5x</option>
                </select>
              </div>
            </div>
          </div>

          {/* Process Workload Table */}
          <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Process Workload ({processes.length})</h3>
              <span className="text-[11px] text-slate-500">Max 8 jobs</span>
            </div>

            <div className="space-y-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1F293D] text-slate-400 pb-2">
                    <th className="py-1.5 font-medium">Job</th>
                    <th className="py-1.5 font-medium">Arrival (T_arr)</th>
                    <th className="py-1.5 font-medium">Burst (T_burst)</th>
                    <th className="py-1.5 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F293D]/60 font-mono">
                  {processes.map((proc) => (
                    <tr key={proc.id} className="hover:bg-slate-900/40">
                      <td className="py-2 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: proc.color }} />
                        <span className="font-semibold text-slate-200">{proc.name}</span>
                      </td>
                      <td className="py-2 text-slate-300">{proc.arrival}</td>
                      <td className="py-2 text-slate-300">{proc.burst} cyc</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleRemoveProcess(proc.id)}
                          disabled={processes.length <= 1}
                          className="text-slate-500 hover:text-rose-400 disabled:opacity-30 p-1"
                          title="Remove process"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add Process Form */}
            <div className="pt-3 border-t border-[#1F293D] flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[80px]">
                <label className="text-[11px] text-slate-400 block mb-1">Arrival</label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={newArrival}
                  onChange={(e) => setNewArrival(Number(e.target.value))}
                  className="w-full bg-[#080C14] border border-[#1F293D] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
              <div className="flex-1 min-w-[80px]">
                <label className="text-[11px] text-slate-400 block mb-1">Burst</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={newBurst}
                  onChange={(e) => setNewBurst(Number(e.target.value))}
                  className="w-full bg-[#080C14] border border-[#1F293D] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
              <button
                onClick={handleAddProcess}
                disabled={processes.length >= 8}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#1F293D] hover:bg-slate-700 text-white text-xs font-medium disabled:opacity-40 min-h-[36px]"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Job
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Gantt Chart & Performance Metrics (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-5 overflow-y-auto">
          {/* Gantt Chart Timeline */}
          <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                Execution Gantt Timeline
              </h3>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-400">Current Cycle:</span>
                <span className="font-mono font-bold text-indigo-400 text-sm">t = {currentTime}</span>
                {currentSlice && (
                  <span className="text-slate-400">
                    Running:{" "}
                    <strong className="text-white" style={{ color: currentSlice.color }}>
                      {currentSlice.processName}
                    </strong>
                  </span>
                )}
              </div>
            </div>

            {/* Visual Timeline Blocks */}
            <div className="relative border border-[#1F293D] rounded-lg bg-[#080C14] p-3 overflow-x-auto">
              <div className="min-w-[600px] flex flex-col gap-2">
                {/* Time markers */}
                <div className="flex text-[10px] text-slate-500 font-mono pl-1">
                  {scheduleResult.timeline.map((_, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "w-7 text-center shrink-0 border-l border-[#1F293D]/50",
                        idx === currentTime && "text-indigo-400 font-bold"
                      )}
                    >
                      {idx}
                    </div>
                  ))}
                </div>

                {/* Slices Track */}
                <div className="flex h-12 rounded border border-[#1F293D] overflow-hidden bg-slate-950">
                  {scheduleResult.timeline.map((slice, idx) => {
                    const isExecuted = idx <= currentTime;
                    const isCurrent = idx === currentTime;

                    return (
                      <div
                        key={idx}
                        className={cn(
                          "w-7 h-full flex items-center justify-center text-[10px] font-bold font-mono transition-all shrink-0 border-r border-[#090D16]/40",
                          isCurrent && "ring-2 ring-white z-10 scale-105"
                        )}
                        style={{
                          backgroundColor: isExecuted ? slice.color : "#121826",
                          opacity: isExecuted ? 1 : 0.25,
                          color: slice.processId ? "#FFFFFF" : "#64748B",
                        }}
                        title={`t=${slice.time}: ${slice.processName}`}
                      >
                        {slice.processId ? slice.processName.split(" ")[0] : "—"}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs text-slate-400 pt-1">
              {processes.map((proc) => (
                <div key={proc.id} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: proc.color }} />
                  <span>{proc.name}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#1E2638]" />
                <span>CPU Idle</span>
              </div>
            </div>
          </div>

          {/* Metrics Dashboard */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-4 flex flex-col gap-1">
              <span className="text-[11px] text-slate-400">Avg Turnaround Time</span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">
                {scheduleResult.avgTurnaround.toFixed(1)} <span className="text-xs text-slate-400 font-normal">cyc</span>
              </div>
              <span className="text-[10px] text-slate-500">T_comp - T_arr</span>
            </div>

            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-4 flex flex-col gap-1">
              <span className="text-[11px] text-slate-400">Avg Response Time</span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 tracking-tight">
                {scheduleResult.avgResponse.toFixed(1)} <span className="text-xs text-slate-400 font-normal">cyc</span>
              </div>
              <span className="text-[10px] text-slate-500">T_first_run - T_arr</span>
            </div>

            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-4 flex flex-col gap-1">
              <span className="text-[11px] text-slate-400">Avg Waiting Time</span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-amber-400 tracking-tight">
                {scheduleResult.avgWait.toFixed(1)} <span className="text-xs text-slate-400 font-normal">cyc</span>
              </div>
              <span className="text-[10px] text-slate-500">T_turnaround - T_burst</span>
            </div>

            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-4 flex flex-col gap-1">
              <span className="text-[11px] text-slate-400">CPU Utilization</span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-indigo-400 tracking-tight">
                {scheduleResult.cpuUtilization.toFixed(0)}%
              </div>
              <span className="text-[10px] text-slate-500">Active vs Total cycles</span>
            </div>
          </div>

          {/* Process Completion Stats Table */}
          <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Individual Job Metrics</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1F293D] text-slate-400">
                    <th className="py-2 font-medium">Job</th>
                    <th className="py-2 font-medium">Arrival</th>
                    <th className="py-2 font-medium">Completion</th>
                    <th className="py-2 font-medium">Turnaround</th>
                    <th className="py-2 font-medium">Response</th>
                    <th className="py-2 font-medium">Wait</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F293D]/60 font-mono">
                  {scheduleResult.processMetrics?.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2 font-semibold text-slate-200 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                        {m.name}
                      </td>
                      <td className="py-2 text-slate-400">{m.arrival}</td>
                      <td className="py-2 text-slate-300">{m.completion}</td>
                      <td className="py-2 text-slate-200 font-bold">{m.turnaround} cyc</td>
                      <td className="py-2 text-emerald-400">{m.response} cyc</td>
                      <td className="py-2 text-amber-400">{m.wait} cyc</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Educational Insights Card */}
          <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
              <HelpCircle className="w-4 h-4" />
              Key System Takeaways
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {algorithm === "FIFO" && (
                <>
                  <b>FIFO Convoy Effect:</b> When a long-running CPU-bound process arrives first, all short processes behind it suffer massive waiting times. Average turnaround time degrades severely.
                </>
              )}
              {algorithm === "SJF" && (
                <>
                  <b>SJF Non-Preemptive:</b> SJF is provably optimal for turnaround time if all jobs arrive at $t=0$. However, if a long job arrives first, SJF cannot preempt it, still suffering from the convoy problem.
                </>
              )}
              {algorithm === "STCF" && (
                <>
                  <b>STCF (Preemptive SJF):</b> When a new job arrives with a shorter remaining burst than the current running job, the OS preempts the current job. This minimizes average turnaround time across all workloads.
                </>
              )}
              {algorithm === "RR" && (
                <>
                  <b>Round Robin Trade-off:</b> RR slices time into quanta $Q$. A small quantum produces stellar response times (great for desktop interactivity), but incurs high context switch overhead. If $Q$ is huge, RR degenerates into FIFO.
                </>
              )}
              {algorithm === "MLFQ" && (
                <>
                  <b>Multi-Level Feedback Queue (MLFQ):</b> Solves the fundamental tension between turnaround and response time without knowing burst lengths in advance! Interactive jobs stay at high priority; CPU-intensive jobs naturally migrate down. Periodic priority boosts prevent starvation.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
