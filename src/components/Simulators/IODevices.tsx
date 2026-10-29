import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { HardDrive, HelpCircle, Activity, Cpu } from "lucide-react";
import { cn } from "../../lib/utils";

type Mode = "Polling" | "Interrupts" | "DMA";

export function IODevices() {
  const [mode, setMode] = useState<Mode>("Interrupts");
  const [transferSize, setTransferSize] = useState(10);
  const [deviceDelay, setDeviceDelay] = useState(5);

  const CS = 3;
  const DMA_SETUP = 2;
  const JOB1_COMPUTE = 10;
  const JOB2_COMPUTE = 15;

  const timeline = useMemo(() => {
    let cpuTimeline: { state: string; duration: number; color: string }[] = [];
    let deviceTimeline: { state: string; duration: number; color: string }[] = [];

    let time = 0;

    // Job 1 runs before I/O
    cpuTimeline.push({ state: "Job 1", duration: JOB1_COMPUTE / 2, color: "#6366F1" });
    time += JOB1_COMPUTE / 2;
    deviceTimeline.push({ state: "Idle", duration: time, color: "#1E2638" });

    let deviceStartTime = time;

    if (mode === "Polling") {
      const workTime = transferSize * deviceDelay;
      cpuTimeline.push({ state: "Polling (Wasted)", duration: workTime, color: "#F43F5E" });
      deviceTimeline.push({ state: "Working", duration: workTime, color: "#F59E0B" });
      time += workTime;

      const copyTime = transferSize * 1;
      cpuTimeline.push({ state: "PIO Copy", duration: copyTime, color: "#10B981" });
      deviceTimeline.push({ state: "Idle", duration: copyTime, color: "#1E2638" });
      time += copyTime;

      cpuTimeline.push({ state: "Job 1", duration: JOB1_COMPUTE / 2, color: "#6366F1" });
      cpuTimeline.push({ state: "Job 2", duration: JOB2_COMPUTE, color: "#38BDF8" });
      deviceTimeline.push({ state: "Idle", duration: JOB1_COMPUTE / 2 + JOB2_COMPUTE, color: "#1E2638" });

    } else if (mode === "Interrupts") {
      const workTime = transferSize * deviceDelay;
      const copyTime = transferSize * 1;

      // Context switch to Job 2
      cpuTimeline.push({ state: "OS (Context Switch)", duration: CS, color: "#64748B" });
      time += CS;

      deviceTimeline.push({ state: "Working", duration: workTime, color: "#F59E0B" });

      // CPU runs Job 2
      cpuTimeline.push({ state: "Job 2", duration: workTime, color: "#38BDF8" });
      time += workTime;

      // Interrupt! Context switch back
      cpuTimeline.push({ state: "OS (Interrupt Handler)", duration: CS, color: "#64748B" });
      time += CS;

      // CPU Copies
      cpuTimeline.push({ state: "PIO Copy", duration: copyTime, color: "#10B981" });
      time += copyTime;

      // Finish Job 1
      cpuTimeline.push({ state: "Job 1", duration: JOB1_COMPUTE / 2, color: "#6366F1" });
      time += JOB1_COMPUTE / 2;

      const remainingJob2 = Math.max(0, JOB2_COMPUTE - workTime);
      if (remainingJob2 > 0) {
        cpuTimeline.push({ state: "Job 2", duration: remainingJob2, color: "#38BDF8" });
        time += remainingJob2;
      }

      deviceTimeline.push({ state: "Idle", duration: time - (deviceStartTime + workTime), color: "#1E2638" });

    } else if (mode === "DMA") {
      // DMA Setup
      cpuTimeline.push({ state: "OS (DMA Setup)", duration: DMA_SETUP, color: "#64748B" });
      time += DMA_SETUP;

      const dmaWorkTime = transferSize * deviceDelay + transferSize * 1;

      deviceTimeline.push({ state: "DMA Controller Copying", duration: dmaWorkTime, color: "#F59E0B" });

      // CPU runs Job 2 while DMA works in parallel!
      cpuTimeline.push({ state: "Job 2", duration: dmaWorkTime, color: "#38BDF8" });
      time += dmaWorkTime;

      // Interrupt when done
      cpuTimeline.push({ state: "OS (Interrupt)", duration: CS, color: "#64748B" });
      time += CS;

      // Finish Job 1
      cpuTimeline.push({ state: "Job 1", duration: JOB1_COMPUTE / 2, color: "#6366F1" });
      time += JOB1_COMPUTE / 2;

      const remainingJob2 = Math.max(0, JOB2_COMPUTE - dmaWorkTime);
      if (remainingJob2 > 0) {
        cpuTimeline.push({ state: "Job 2", duration: remainingJob2, color: "#38BDF8" });
        time += remainingJob2;
      }

      deviceTimeline.push({ state: "Idle", duration: time - (deviceStartTime + dmaWorkTime), color: "#1E2638" });
    }

    let useful = 0;
    let wasted = 0;
    cpuTimeline.forEach((block) => {
      if (block.state.includes("Job") || block.state.includes("Copy")) useful += block.duration;
      else wasted += block.duration;
    });

    const totalTime = cpuTimeline.reduce((sum, b) => sum + b.duration, 0);

    return { cpuTimeline, deviceTimeline, totalTime, useful, wasted };
  }, [mode, transferSize, deviceDelay]);

  const pieData = [
    { name: "Useful CPU Work", value: timeline.useful, color: "#10B981" },
    { name: "Wasted / Overhead", value: timeline.wasted, color: "#F43F5E" },
  ];

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <HardDrive className="w-7 h-7 text-indigo-400" />
          I/O Devices, Interrupts & DMA
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>OSTEP Chapter 36</span>
          <span aria-hidden="true">·</span>
          <span>Programmed I/O (Polling) vs Interrupts vs Direct Memory Access (DMA)</span>
          <span aria-hidden="true">·</span>
          <span>Overhead & CPU Utilization</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Controls Column (4 cols) */}
        <div className="lg:col-span-4 bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-5 overflow-y-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Device Configuration</h3>

          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">I/O Interaction Mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as Mode)}
                className="bg-[#080C14] border border-[#1F293D] rounded-lg px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500 min-h-[44px]"
              >
                <option value="Polling">PIO with Busy-Wait Polling</option>
                <option value="Interrupts">Interrupt-Driven I/O</option>
                <option value="DMA">Direct Memory Access (DMA)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Transfer Block Size</span>
                <span className="font-mono text-indigo-400 font-semibold">{transferSize} blocks</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={transferSize}
                onChange={(e) => setTransferSize(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Device Delay (per block)</span>
                <span className="font-mono text-amber-400 font-semibold">{deviceDelay} cycles</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={deviceDelay}
                onChange={(e) => setDeviceDelay(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
              <span className="text-[11px] text-slate-500 mt-1">
                {deviceDelay <= 2 ? "Fast Device (NVMe SSD / High-Speed Network)" : "Slow Device (Magnetic HDD / Serial)"}
              </span>
            </div>

            <div className="pt-4 border-t border-[#1F293D] flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-400">
                <HelpCircle className="w-3.5 h-3.5" />
                Architectural Insights
              </div>
              <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4 leading-relaxed">
                {mode === "Polling" && (
                  <li>
                    <b>Polling (PIO):</b> The CPU is locked in a busy-wait loop testing the device status register. On slow devices, massive numbers of compute cycles are completely squandered.
                  </li>
                )}
                {mode === "Interrupts" && (
                  <li>
                    <b>Interrupts:</b> The OS initiates I/O, puts the calling process to sleep, and switches to another ready job. When the device is done, a hardware interrupt signals the CPU. If the device is ultra-fast, context-switch overhead can exceed polling!
                  </li>
                )}
                {mode === "DMA" && (
                  <li>
                    <b>DMA:</b> A specialized DMA controller offloads both waiting AND memory copying. The CPU performs setup, continues user work, and is interrupted only once when the entire multi-block transfer completes.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Visualizer Column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-5 overflow-y-auto">
          {/* Execution Timeline */}
          <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Cycle-Accurate Hardware Timeline
            </h3>

            <div className="flex flex-col gap-3">
              {/* CPU Timeline */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-mono font-semibold text-slate-400">CPU Core</span>
                <div className="flex h-12 rounded-lg border border-[#1F293D] bg-[#080C14] overflow-hidden">
                  {timeline.cpuTimeline.map((block, i) => (
                    <div
                      key={i}
                      className="h-full flex items-center justify-center text-[11px] font-semibold text-white/95 border-r border-[#090D16]/50 truncate px-1"
                      style={{
                        width: `${(block.duration / timeline.totalTime) * 100}%`,
                        backgroundColor: block.color,
                      }}
                      title={`${block.state} (${block.duration} cycles)`}
                    >
                      {block.state}
                    </div>
                  ))}
                </div>
              </div>

              {/* Device / DMA Timeline */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-mono font-semibold text-slate-400">I/O Device / DMA Bus</span>
                <div className="flex h-12 rounded-lg border border-[#1F293D] bg-[#080C14] overflow-hidden">
                  {timeline.deviceTimeline.map((block, i) => (
                    <div
                      key={i}
                      className="h-full flex items-center justify-center text-[11px] font-semibold text-white/95 border-r border-[#090D16]/50 truncate px-1"
                      style={{
                        width: `${(block.duration / timeline.totalTime) * 100}%`,
                        backgroundColor: block.color,
                      }}
                      title={`${block.state} (${block.duration} cycles)`}
                    >
                      {block.state}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs text-slate-400 pt-1 justify-center sm:justify-start">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#6366F1]" />
                <span>Job 1</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#38BDF8]" />
                <span>Job 2</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#10B981]" />
                <span>PIO Copy</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#64748B]" />
                <span>OS Overhead</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#F59E0B]" />
                <span>Device / DMA Busy</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#F43F5E]" />
                <span>Wasted Polling</span>
              </div>
            </div>
          </div>

          {/* Lower Row: Donut Chart + Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 flex-1">
            {/* Donut Chart */}
            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col items-center justify-center">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                CPU Time Distribution
              </h3>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${value.toFixed(1)} cycles`, ""]}
                      contentStyle={{
                        backgroundColor: "#090D16",
                        borderColor: "#1F293D",
                        color: "#F1F5F9",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", color: "#94A3B8" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Performance Metric Cards */}
            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col justify-center gap-4">
              <div className="bg-[#080C14] border border-[#1F293D] rounded-lg p-4 text-center">
                <span className="text-[11px] text-slate-400 block mb-0.5">Total Execution Time</span>
                <span className="text-3xl font-bold font-mono text-white tracking-tight">
                  {timeline.totalTime.toFixed(1)} <span className="text-base text-slate-400 font-normal">cycles</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-emerald-400 flex flex-col gap-0.5">
                  <span className="text-[10px] text-emerald-300/80">Useful CPU Work</span>
                  <span className="text-xl font-bold font-mono">
                    {((timeline.useful / timeline.totalTime) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-rose-400 flex flex-col gap-0.5">
                  <span className="text-[10px] text-rose-300/80">Wasted / Overhead</span>
                  <span className="text-xl font-bold font-mono">
                    {((timeline.wasted / timeline.totalTime) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
