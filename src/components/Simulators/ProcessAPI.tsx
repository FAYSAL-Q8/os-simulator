import { useState, useRef } from "react";
import { GitFork, Play, RotateCcw, HelpCircle, Terminal, RefreshCw, Cpu, Layers } from "lucide-react";
import { cn } from "../../lib/utils";

export type ProcessState = "RUNNING" | "READY" | "BLOCKED" | "ZOMBIE";

export interface ProcessNode {
  pid: number;
  ppid: number | null;
  name: string;
  state: ProcessState;
  cpuTime: number;
  program: string;
  children: number[];
}

export function ProcessAPI() {
  const [processes, setProcesses] = useState<ProcessNode[]>([
    { pid: 1, ppid: null, name: "init", state: "RUNNING", cpuTime: 12, program: "/sbin/init", children: [] },
  ]);
  const [activePid, setActivePid] = useState<number>(1);
  const [nextPid, setNextPid] = useState<number>(2);
  const [logs, setLogs] = useState<{ id: number; message: string; type: "syscall" | "kernel" | "user" }[]>([
    { id: 1, message: "Kernel boot complete. Initialized PID 1 (init / systemd) as root ancestor.", type: "kernel" },
  ]);
  const logIdRef = useRef(2);

  const addLog = (message: string, type: "syscall" | "kernel" | "user" = "kernel") => {
    setLogs((prev) => [{ id: logIdRef.current++, message, type }, ...prev].slice(0, 12));
  };

  // Fork system call
  const handleFork = () => {
    const parent = processes.find((p) => p.pid === activePid);
    if (!parent) return;

    if (parent.state === "ZOMBIE") {
      addLog(`fork() failed: Process ${parent.pid} is a ZOMBIE and cannot execute system calls.`, "kernel");
      return;
    }

    const childPid = nextPid;
    setNextPid((prev) => prev + 1);

    const childNode: ProcessNode = {
      pid: childPid,
      ppid: parent.pid,
      name: `${parent.name}-child`,
      state: "READY",
      cpuTime: 0,
      program: parent.program, // Copy on write image
      children: [],
    };

    setProcesses((prev) =>
      prev.map((p) => (p.pid === parent.pid ? { ...p, children: [...p.children, childPid] } : p)).concat(childNode)
    );

    addLog(`syscall: fork() executed by PID ${parent.pid}. Spawned duplicate child PID ${childPid} in READY state.`, "syscall");
  };

  // Exec system call
  const handleExec = (newProg: string) => {
    const proc = processes.find((p) => p.pid === activePid);
    if (!proc) return;

    if (proc.state === "ZOMBIE") {
      addLog(`exec() failed: Cannot replace code image of zombie PID ${proc.pid}.`, "kernel");
      return;
    }

    setProcesses((prev) =>
      prev.map((p) =>
        p.pid === activePid
          ? { ...p, program: newProg, name: newProg.split("/").pop() || "exec_proc", cpuTime: 0 }
          : p
      )
    );

    addLog(`syscall: execvp("${newProg}") replaced address space of PID ${proc.pid}. Old code discarded.`, "syscall");
  };

  // Wait system call
  const handleWait = () => {
    const parent = processes.find((p) => p.pid === activePid);
    if (!parent) return;

    const zombieChild = processes.find((p) => p.ppid === parent.pid && p.state === "ZOMBIE");

    if (zombieChild) {
      // Reap the zombie
      setProcesses((prev) => prev.filter((p) => p.pid !== zombieChild.pid));
      addLog(`syscall: wait() reaped terminated child PID ${zombieChild.pid}. Released PCB and exit status code 0.`, "syscall");
    } else {
      const liveChild = processes.find((p) => p.ppid === parent.pid && p.state !== "ZOMBIE");
      if (liveChild) {
        // Parent blocks waiting for child
        setProcesses((prev) =>
          prev.map((p) => (p.pid === parent.pid ? { ...p, state: "BLOCKED" } : p))
        );
        addLog(`syscall: wait() blocked PID ${parent.pid} waiting for child termination. State -> BLOCKED.`, "syscall");
      } else {
        addLog(`syscall: wait() returned -1 (ECHILD): PID ${parent.pid} has no un-reaped children.`, "user");
      }
    }
  };

  // Exit system call
  const handleExit = () => {
    const proc = processes.find((p) => p.pid === activePid);
    if (!proc || proc.pid === 1) {
      addLog("Cannot terminate root ancestor PID 1 (init/systemd)!", "kernel");
      return;
    }

    // Process becomes zombie until parent reaps it
    setProcesses((prev) =>
      prev.map((p) => {
        if (p.pid === proc.pid) return { ...p, state: "ZOMBIE" };
        // If parent was BLOCKED on wait, unblock it
        if (p.pid === proc.ppid && p.state === "BLOCKED") return { ...p, state: "READY" };
        return p;
      })
    );

    addLog(`syscall: exit(0) invoked by PID ${proc.pid}. Process entered ZOMBIE state awaiting parent wait().`, "syscall");
  };

  // Context switch to another process
  const handleContextSwitch = (targetPid: number) => {
    if (targetPid === activePid) return;
    const target = processes.find((p) => p.pid === targetPid);
    if (!target) return;

    setProcesses((prev) =>
      prev.map((p) => {
        if (p.pid === activePid && p.state === "RUNNING") return { ...p, state: "READY" };
        if (p.pid === targetPid && p.state === "READY") return { ...p, state: "RUNNING", cpuTime: p.cpuTime + 1 };
        return p;
      })
    );

    setActivePid(targetPid);
    addLog(`kernel: Context switch performed from PID ${activePid} -> PID ${targetPid} (saved & restored register state).`, "kernel");
  };

  const handleReset = () => {
    setProcesses([
      { pid: 1, ppid: null, name: "init", state: "RUNNING", cpuTime: 12, program: "/sbin/init", children: [] },
    ]);
    setActivePid(1);
    setNextPid(2);
    setLogs([{ id: 1, message: "Kernel reset to clean initial boot state.", type: "kernel" }]);
    logIdRef.current = 2;
  };

  const activeProcess = processes.find((p) => p.pid === activePid) || processes[0];

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <GitFork className="w-7 h-7 text-indigo-400" />
          Process API & Lifecycle Simulator
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>OSTEP Chapters 4, 5 & 6</span>
          <span aria-hidden="true">·</span>
          <span>fork(), exec(), wait(), exit() & Zombie Reaping</span>
          <span aria-hidden="true">·</span>
          <span>Process Control Block (PCB) & Context Switching</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Controls Column (4 cols) */}
        <div className="lg:col-span-4 bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-5 overflow-y-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Process System Calls</h3>

          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">Currently Selected Process</label>
              <select
                value={activePid}
                onChange={(e) => setActivePid(Number(e.target.value))}
                className="bg-[#080C14] border border-[#1F293D] rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500 min-h-[44px]"
              >
                {processes.map((p) => (
                  <option key={p.pid} value={p.pid}>
                    PID {p.pid}: {p.name} ({p.state})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={handleFork}
                className="py-2.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 min-h-[44px]"
              >
                <GitFork className="w-4 h-4" /> fork()
              </button>

              <button
                onClick={handleWait}
                className="py-2.5 px-3 rounded-lg bg-[#080C14] hover:bg-slate-800 border border-[#1F293D] text-slate-200 font-semibold text-xs transition-colors min-h-[44px]"
              >
                wait()
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">Replace Address Space with execvp()</label>
              <div className="grid grid-cols-3 gap-2">
                {["/bin/ls", "/usr/bin/python", "/bin/bash"].map((prog) => (
                  <button
                    key={prog}
                    onClick={() => handleExec(prog)}
                    className="py-2 px-2 rounded-lg bg-[#080C14] hover:bg-slate-800 border border-[#1F293D] text-slate-300 text-[11px] font-mono truncate"
                    title={prog}
                  >
                    {prog.split("/").pop()}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#1F293D]">
              <button
                onClick={handleExit}
                disabled={activePid === 1}
                className="py-2.5 px-3 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white font-semibold text-xs transition-colors disabled:opacity-40 min-h-[44px]"
              >
                exit(0)
              </button>

              <button
                onClick={handleReset}
                className="py-2.5 px-3 rounded-lg bg-[#080C14] hover:bg-slate-800 border border-[#1F293D] text-slate-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 min-h-[44px]"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Kernel
              </button>
            </div>
          </div>

          {/* Educational Callout */}
          <div className="mt-auto pt-4 border-t border-[#1F293D] text-xs text-slate-400 space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-indigo-400">
              <HelpCircle className="w-3.5 h-3.5" />
              Process Lifecycle Rules
            </div>
            <p>
              • <b>fork():</b> Creates an exact clone of the caller. Child returns 0, parent returns child PID.<br />
              • <b>exec():</b> Overwrites the current process address space with a new program image.<br />
              • <b>wait():</b> Suspends caller until child terminates, then reaps its exit code.<br />
              • <b>Zombie State:</b> A process that exited but hasn't been reaped by parent yet.
            </p>
          </div>
        </div>

        {/* Visualizer Column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-5 overflow-y-auto">
          {/* Active Process Control Block (PCB) */}
          <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" />
                Active Process Control Block (PCB) · PID {activeProcess.pid}
              </h3>
              <span
                className={cn(
                  "text-xs font-mono font-bold",
                  activeProcess.state === "RUNNING"
                    ? "text-emerald-400"
                    : activeProcess.state === "READY"
                    ? "text-indigo-400"
                    : activeProcess.state === "BLOCKED"
                    ? "text-amber-400"
                    : "text-rose-400"
                )}
              >
                ● {activeProcess.state}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div className="bg-[#080C14] border border-[#1F293D] rounded-lg p-3">
                <span className="text-[10px] text-slate-400 block mb-0.5">Parent PID</span>
                <span className="font-bold text-slate-200">{activeProcess.ppid !== null ? activeProcess.ppid : "None (Root)"}</span>
              </div>
              <div className="bg-[#080C14] border border-[#1F293D] rounded-lg p-3">
                <span className="text-[10px] text-slate-400 block mb-0.5">Executable Image</span>
                <span className="font-bold text-indigo-300 truncate block">{activeProcess.program}</span>
              </div>
              <div className="bg-[#080C14] border border-[#1F293D] rounded-lg p-3">
                <span className="text-[10px] text-slate-400 block mb-0.5">CPU Time Consumed</span>
                <span className="font-bold text-white">{activeProcess.cpuTime} cycles</span>
              </div>
              <div className="bg-[#080C14] border border-[#1F293D] rounded-lg p-3">
                <span className="text-[10px] text-slate-400 block mb-0.5">Child Count</span>
                <span className="font-bold text-slate-200">{activeProcess.children.length}</span>
              </div>
            </div>
          </div>

          {/* Process Tree & Hierarchy */}
          <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Kernel Process Tree & Context Dispatcher
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {processes.map((proc) => {
                const isCurrent = proc.pid === activePid;

                return (
                  <div
                    key={proc.pid}
                    className={cn(
                      "p-3 rounded-lg border flex flex-col gap-2 transition-all cursor-pointer",
                      isCurrent
                        ? "bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500/50"
                        : "bg-[#080C14] border-[#1F293D] hover:border-slate-600"
                    )}
                    onClick={() => handleContextSwitch(proc.pid)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-slate-200">
                        PID {proc.pid}: {proc.name}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-mono font-semibold",
                          proc.state === "RUNNING"
                            ? "text-emerald-400"
                            : proc.state === "READY"
                            ? "text-indigo-400"
                            : proc.state === "BLOCKED"
                            ? "text-amber-400"
                            : "text-rose-400"
                        )}
                      >
                        {proc.state}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 truncate">
                      Prog: {proc.program}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#1F293D]/60 text-[10px] text-slate-500 font-mono">
                      <span>PPID: {proc.ppid !== null ? proc.ppid : "Root"}</span>
                      {proc.state === "READY" && (
                        <span className="text-indigo-400 hover:underline">Click to Run</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Kernel System Call Log */}
          <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-3 min-h-[180px]">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-400" />
              Kernel Trap & System Call Trace
            </h3>

            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-48 pr-1 font-mono text-xs">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    "p-2 rounded-lg border",
                    log.type === "syscall"
                      ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-200"
                      : log.type === "user"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                      : "bg-[#080C14] border-[#1F293D] text-slate-300"
                  )}
                >
                  <span className="text-slate-500 mr-2">[{log.id.toString().padStart(3, "0")}]</span>
                  {log.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
