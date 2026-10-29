import { useState, useEffect, useRef } from "react";
import { 
  Users, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  Play, 
  Pause, 
  RotateCcw, 
  ShieldCheck, 
  HelpCircle, 
  Layers, 
  ArrowRight,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { cn } from "../../lib/utils";

type SyncMode = "Unsafe" | "Mutex" | "Semaphores";
type ActiveTab = "bounded-buffer" | "deadlock";

interface BufferItem {
  id: number;
  val: string;
  producedBy: string;
}

export function ConcurrencySync() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("bounded-buffer");

  // --- BOUNDED BUFFER STATE ---
  const [syncMode, setSyncMode] = useState<SyncMode>("Unsafe");
  const [bufferCapacity, setBufferCapacity] = useState(5);
  const [buffer, setBuffer] = useState<(BufferItem | null)[]>(Array(5).fill(null));
  const [inPtr, setInPtr] = useState(0);
  const [outPtr, setOutPtr] = useState(0);
  const [count, setCount] = useState(0);

  // Semaphores state
  const [mutexLock, setMutexLock] = useState<"unlocked" | "held_by_producer" | "held_by_consumer">("unlocked");
  const [emptySem, setEmptySem] = useState(5); // number of empty slots
  const [fullSem, setFullSem] = useState(0);   // number of full slots

  // Threads & Execution
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [producerState, setProducerState] = useState<"IDLE" | "PRODUCING" | "WAITING_LOCK" | "BLOCKED_FULL">("IDLE");
  const [consumerState, setConsumerState] = useState<"IDLE" | "CONSUMING" | "WAITING_LOCK" | "BLOCKED_EMPTY">("IDLE");
  const [raceDetected, setRaceDetected] = useState<string | null>(null);
  const [eventLogs, setEventLogs] = useState<{ id: number; message: string; type: "info" | "warn" | "error" | "success" }[]>([]);
  const logIdRef = useRef(1);
  const autoPlayTimerRef = useRef<number | null>(null);

  // Reset buffer when capacity or sync mode changes
  const resetBuffer = (cap: number = bufferCapacity, mode: SyncMode = syncMode) => {
    setBuffer(Array(cap).fill(null));
    setInPtr(0);
    setOutPtr(0);
    setCount(0);
    setMutexLock("unlocked");
    setEmptySem(cap);
    setFullSem(0);
    setProducerState("IDLE");
    setConsumerState("IDLE");
    setRaceDetected(null);
    setIsAutoPlaying(false);
  };

  const addLog = (message: string, type: "info" | "warn" | "error" | "success" = "info") => {
    setEventLogs((prev) => [{ id: logIdRef.current++, message, type }, ...prev].slice(0, 12));
  };

  // Handle Producer Action
  const handleProduce = () => {
    if (syncMode === "Unsafe") {
      // Race condition danger: No check or check without lock
      if (count >= bufferCapacity) {
        setRaceDetected("BUFFER OVERFLOW RACE CONDITION! Producer overwrote an unconsumed slot because count check was uncoordinated.");
        addLog("BUFFER OVERFLOW: Producer overwrote valid data in buffer!", "error");
      }

      const item: BufferItem = { id: Date.now() % 1000, val: `Data-${Math.floor(Math.random() * 90 + 10)}`, producedBy: "Producer" };
      const nextBuf = [...buffer];
      nextBuf[inPtr] = item;
      setBuffer(nextBuf);
      setInPtr((inPtr + 1) % bufferCapacity);
      setCount((prev) => prev + 1);
      setProducerState("PRODUCING");
      addLog(`Producer deposited "${item.val}" at slot [${inPtr}] (Unsynchronized count=${count + 1})`, "warn");
      setTimeout(() => setProducerState("IDLE"), 400);

    } else if (syncMode === "Mutex") {
      if (mutexLock !== "unlocked") {
        setProducerState("WAITING_LOCK");
        addLog("Producer tried to enter Critical Section but Mutex is locked!", "warn");
        return;
      }
      if (count >= bufferCapacity) {
        setProducerState("BLOCKED_FULL");
        addLog("Producer blocked: Buffer is completely full.", "info");
        return;
      }

      // Acquire lock, produce, release lock
      setMutexLock("held_by_producer");
      setProducerState("PRODUCING");

      const item: BufferItem = { id: Date.now() % 1000, val: `Pkg-${Math.floor(Math.random() * 90 + 10)}`, producedBy: "Producer" };
      const nextBuf = [...buffer];
      nextBuf[inPtr] = item;
      setBuffer(nextBuf);
      setInPtr((inPtr + 1) % bufferCapacity);
      setCount((prev) => prev + 1);
      addLog(`Producer acquired mutex -> inserted "${item.val}" at [${inPtr}] -> released mutex`, "success");

      setTimeout(() => {
        setMutexLock("unlocked");
        setProducerState("IDLE");
      }, 400);

    } else if (syncMode === "Semaphores") {
      // Semaphores: sem_wait(&empty); sem_wait(&mutex); ... sem_post(&mutex); sem_post(&full);
      if (emptySem <= 0) {
        setProducerState("BLOCKED_FULL");
        addLog("sem_wait(&empty): Empty semaphore is 0! Producer sleeps on wait queue.", "warn");
        return;
      }

      setEmptySem((prev) => prev - 1);
      setMutexLock("held_by_producer");
      setProducerState("PRODUCING");

      const item: BufferItem = { id: Date.now() % 1000, val: `Msg-${Math.floor(Math.random() * 90 + 10)}`, producedBy: "Producer" };
      const nextBuf = [...buffer];
      nextBuf[inPtr] = item;
      setBuffer(nextBuf);
      setInPtr((inPtr + 1) % bufferCapacity);
      setCount((prev) => prev + 1);
      setFullSem((prev) => prev + 1);

      addLog(`sem_wait(&empty) succeeded -> sem_post(&full) -> produced "${item.val}" at [${inPtr}]`, "success");

      setTimeout(() => {
        setMutexLock("unlocked");
        setProducerState("IDLE");
      }, 400);
    }
  };

  // Handle Consumer Action
  const handleConsume = () => {
    if (syncMode === "Unsafe") {
      if (count <= 0) {
        setRaceDetected("BUFFER UNDERFLOW RACE CONDITION! Consumer read from an empty slot or double-consumed unpopulated memory!");
        addLog("BUFFER UNDERFLOW: Consumer read invalid memory from empty buffer!", "error");
      }

      const item = buffer[outPtr];
      const nextBuf = [...buffer];
      nextBuf[outPtr] = null;
      setBuffer(nextBuf);
      setOutPtr((outPtr + 1) % bufferCapacity);
      setCount((prev) => Math.max(0, prev - 1));
      setConsumerState("CONSUMING");
      addLog(`Consumer extracted from slot [${outPtr}] ("${item?.val || 'GARBAGE'}") (count=${count - 1})`, "warn");
      setTimeout(() => setConsumerState("IDLE"), 400);

    } else if (syncMode === "Mutex") {
      if (mutexLock !== "unlocked") {
        setConsumerState("WAITING_LOCK");
        addLog("Consumer tried to acquire Mutex but it is currently locked!", "warn");
        return;
      }
      if (count <= 0) {
        setConsumerState("BLOCKED_EMPTY");
        addLog("Consumer blocked: Buffer is completely empty.", "info");
        return;
      }

      setMutexLock("held_by_consumer");
      setConsumerState("CONSUMING");

      const item = buffer[outPtr];
      const nextBuf = [...buffer];
      nextBuf[outPtr] = null;
      setBuffer(nextBuf);
      setOutPtr((outPtr + 1) % bufferCapacity);
      setCount((prev) => prev - 1);
      addLog(`Consumer acquired mutex -> consumed "${item?.val}" from [${outPtr}] -> released mutex`, "success");

      setTimeout(() => {
        setMutexLock("unlocked");
        setConsumerState("IDLE");
      }, 400);

    } else if (syncMode === "Semaphores") {
      // sem_wait(&full); sem_wait(&mutex); ... sem_post(&mutex); sem_post(&empty);
      if (fullSem <= 0) {
        setConsumerState("BLOCKED_EMPTY");
        addLog("sem_wait(&full): Full semaphore is 0! Consumer sleeps on wait queue.", "warn");
        return;
      }

      setFullSem((prev) => prev - 1);
      setMutexLock("held_by_consumer");
      setConsumerState("CONSUMING");

      const item = buffer[outPtr];
      const nextBuf = [...buffer];
      nextBuf[outPtr] = null;
      setBuffer(nextBuf);
      setOutPtr((outPtr + 1) % bufferCapacity);
      setCount((prev) => prev - 1);
      setEmptySem((prev) => prev + 1);

      addLog(`sem_wait(&full) succeeded -> sem_post(&empty) -> consumed "${item?.val}" from [${outPtr}]`, "success");

      setTimeout(() => {
        setMutexLock("unlocked");
        setConsumerState("IDLE");
      }, 400);
    }
  };

  // Auto-play simulated threads racing
  useEffect(() => {
    if (isAutoPlaying) {
      autoPlayTimerRef.current = window.setInterval(() => {
        const action = Math.random() > 0.45 ? "produce" : "consume";
        if (action === "produce") {
          handleProduce();
        } else {
          handleConsume();
        }
      }, 700);
    } else if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
    }
    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [isAutoPlaying, syncMode, buffer, inPtr, outPtr, count, emptySem, fullSem, mutexLock]);

  // --- DEADLOCK EXPLORER STATE ---
  const [deadlockStrategy, setDeadlockStrategy] = useState<"Dangerous" | "LockOrdering">("Dangerous");
  const [deadlockStep, setDeadlockStep] = useState(0);

  // States:
  // Step 0: Initial
  // Step 1: Thread 1 acquires R1
  // Step 2: Thread 2 acquires R2 (or R1 if LockOrdering)
  // Step 3: Thread 1 requests R2
  // Step 4: Thread 2 requests R1 -> DEADLOCK (if dangerous) OR Thread 2 waits, Thread 1 completes (if LockOrdering)!
  const deadlockStatus = {
    t1Holds: deadlockStep >= 1 ? "R1" : null,
    t1Wants: deadlockStep >= 3 ? "R2" : null,
    t2Holds:
      deadlockStrategy === "Dangerous"
        ? deadlockStep >= 2 ? "R2" : null
        : deadlockStep >= 4 ? "R1" : null,
    t2Wants:
      deadlockStrategy === "Dangerous"
        ? deadlockStep >= 4 ? "R1" : null
        : deadlockStep >= 2 ? "R1" : null,
    isDeadlocked: deadlockStrategy === "Dangerous" && deadlockStep >= 4,
    isResolved: deadlockStrategy === "LockOrdering" && deadlockStep >= 4,
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <Users className="w-7 h-7 text-indigo-400" />
          Concurrency & Synchronization
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>OSTEP Chapters 28–32</span>
          <span aria-hidden="true">·</span>
          <span>Race Conditions, Mutex Locks & Semaphores</span>
          <span aria-hidden="true">·</span>
          <span>Deadlock 4 Coffman Conditions</span>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-1 p-1 bg-[#121826] border border-[#1F293D] rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("bounded-buffer")}
          className={cn(
            "px-4 py-2 text-xs font-semibold rounded-lg transition-colors min-h-[40px] flex items-center gap-2",
            activeTab === "bounded-buffer"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          )}
        >
          <Layers className="w-4 h-4" />
          Producer-Consumer Bounded Buffer
        </button>
        <button
          onClick={() => setActiveTab("deadlock")}
          className={cn(
            "px-4 py-2 text-xs font-semibold rounded-lg transition-colors min-h-[40px] flex items-center gap-2",
            activeTab === "deadlock"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          )}
        >
          <Lock className="w-4 h-4" />
          Deadlock Graph & Coffman Conditions
        </button>
      </div>

      {/* TAB 1: BOUNDED BUFFER */}
      {activeTab === "bounded-buffer" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
          {/* Controls Column (4 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5 overflow-y-auto">
            {/* Mode Selector */}
            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Synchronization Primitive</h3>

              <div className="grid grid-cols-3 gap-2">
                {(["Unsafe", "Mutex", "Semaphores"] as SyncMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setSyncMode(m);
                      resetBuffer(bufferCapacity, m);
                    }}
                    className={cn(
                      "py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all text-center",
                      syncMode === m
                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                        : "bg-[#090D16] border-[#1F293D] text-slate-400 hover:text-slate-200"
                    )}
                  >
                    {m === "Unsafe" && "Race Condition"}
                    {m === "Mutex" && "Mutex Lock"}
                    {m === "Semaphores" && "Semaphores"}
                  </button>
                ))}
              </div>

              {/* Buffer Capacity Slider */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Buffer Capacity</span>
                  <span className="font-mono text-indigo-400">{bufferCapacity} slots</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="8"
                  value={bufferCapacity}
                  onChange={(e) => {
                    const c = Number(e.target.value);
                    setBufferCapacity(c);
                    resetBuffer(c, syncMode);
                  }}
                  className="w-full accent-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#1F293D] flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleProduce}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors min-h-[44px]"
                  >
                    Produce Item
                  </button>
                  <button
                    onClick={handleConsume}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors min-h-[44px]"
                  >
                    Consume Item
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#090D16] border border-[#1F293D] hover:bg-slate-800 text-slate-200 text-xs font-medium transition-colors min-h-[40px]"
                  >
                    {isAutoPlaying ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
                    {isAutoPlaying ? "Pause Auto-Racing" : "Auto-Race Threads"}
                  </button>
                  <button
                    onClick={() => resetBuffer()}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#090D16] border border-[#1F293D] hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-medium min-h-[40px]"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* State Meters */}
            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Synchronization Variables</h3>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-[#090D16] border border-[#1F293D] rounded-lg p-3">
                  <span className="text-[10px] text-slate-400 block mb-1">Item Count</span>
                  <span className="text-xl font-bold font-mono text-white">{count}</span>
                  <span className="text-[10px] text-slate-500 block">/ {bufferCapacity}</span>
                </div>

                <div className="bg-[#090D16] border border-[#1F293D] rounded-lg p-3">
                  <span className="text-[10px] text-slate-400 block mb-1">Mutex Lock</span>
                  <span
                    className={cn(
                      "text-xs font-bold block mt-1",
                      mutexLock === "unlocked" ? "text-emerald-400" : "text-rose-400"
                    )}
                  >
                    {mutexLock === "unlocked" ? "UNLOCKED" : "LOCKED"}
                  </span>
                  <span className="text-[9px] text-slate-500 block">
                    {mutexLock === "held_by_producer" && "By Producer"}
                    {mutexLock === "held_by_consumer" && "By Consumer"}
                    {mutexLock === "unlocked" && "Available"}
                  </span>
                </div>

                <div className="bg-[#090D16] border border-[#1F293D] rounded-lg p-3">
                  <span className="text-[10px] text-slate-400 block mb-1">Semaphores</span>
                  {syncMode === "Semaphores" ? (
                    <div className="text-xs font-mono text-slate-200 flex flex-col gap-0.5">
                      <span>empty: <strong className="text-emerald-400">{emptySem}</strong></span>
                      <span>full: <strong className="text-amber-400">{fullSem}</strong></span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500 italic mt-2 block">Inactive</span>
                  )}
                </div>
              </div>

              {/* Thread Status */}
              <div className="pt-2 border-t border-[#1F293D] flex items-center justify-around text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-slate-300">Producer:</span>
                  <strong className="text-emerald-400 font-mono">{producerState}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="text-slate-300">Consumer:</span>
                  <strong className="text-amber-400 font-mono">{consumerState}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Visualization Column (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-5 overflow-y-auto">
            {/* Race Alert Banner */}
            {raceDetected && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 flex items-start gap-3 animate-pulse">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <strong className="block text-sm font-bold text-white mb-1">RACE CONDITION ANOMALY DETECTED!</strong>
                  {raceDetected}
                </div>
              </div>
            )}

            {/* Bounded Buffer Circular / Linear Slots */}
            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Shared Bounded Buffer</h3>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>in = <strong className="text-emerald-400 font-mono">[{inPtr}]</strong></span>
                  <span>out = <strong className="text-amber-400 font-mono">[{outPtr}]</strong></span>
                </div>
              </div>

              {/* Slots Graphic */}
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-3 py-4">
                {buffer.map((item, idx) => {
                  const isIn = inPtr === idx;
                  const isOut = outPtr === idx;

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all h-28",
                        item
                          ? "bg-slate-900/80 border-indigo-500/40 text-white"
                          : "bg-[#090D16] border-[#1F293D] text-slate-600",
                        isIn && "ring-2 ring-emerald-500/60",
                        isOut && "ring-2 ring-amber-500/60"
                      )}
                    >
                      {/* Slot index */}
                      <span className="text-[10px] font-mono text-slate-500 absolute top-2 left-2">
                        #{idx}
                      </span>

                      {/* Item content */}
                      {item ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="w-3 h-3 rounded-full bg-indigo-500" />
                          <span className="text-xs font-mono font-bold">{item.val}</span>
                        </div>
                      ) : (
                        <span className="text-xs italic text-slate-600">Empty</span>
                      )}

                      {/* Pointers */}
                      <div className="absolute -bottom-2 flex gap-1">
                        {isIn && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            IN
                          </span>
                        )}
                        {isOut && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            OUT
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Event Execution Log */}
            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-3 min-h-[220px]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Concurrency Event Log</h4>
              <div className="flex flex-col gap-1.5 overflow-y-auto max-h-56 pr-1 font-mono text-xs">
                {eventLogs.map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      "p-2 rounded-lg border",
                      log.type === "error"
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                        : log.type === "warn"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                        : log.type === "success"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-[#090D16] border-[#1F293D] text-slate-300"
                    )}
                  >
                    <span className="text-slate-500 mr-2">[{log.id.toString().padStart(3, "0")}]</span>
                    {log.message}
                  </div>
                ))}
                {eventLogs.length === 0 && (
                  <span className="text-slate-500 italic text-xs">Ready. Click Produce, Consume, or Auto-Race.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DEADLOCK & COFFMAN CONDITIONS */}
      {activeTab === "deadlock" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
          {/* Left Column (5 cols): Strategy & Coffman Conditions */}
          <div className="lg:col-span-5 flex flex-col gap-5 overflow-y-auto">
            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Lock Acquisition Strategy</h3>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setDeadlockStrategy("Dangerous");
                    setDeadlockStep(0);
                  }}
                  className={cn(
                    "p-3 rounded-lg text-xs font-semibold border transition-all text-left",
                    deadlockStrategy === "Dangerous"
                      ? "bg-rose-500/20 border-rose-500 text-rose-300"
                      : "bg-[#090D16] border-[#1F293D] text-slate-400 hover:text-white"
                  )}
                >
                  <strong className="block mb-1">Circular Wait Risk</strong>
                  <span className="text-[10px] text-slate-400 font-normal">T1: R1→R2, T2: R2→R1</span>
                </button>

                <button
                  onClick={() => {
                    setDeadlockStrategy("LockOrdering");
                    setDeadlockStep(0);
                  }}
                  className={cn(
                    "p-3 rounded-lg text-xs font-semibold border transition-all text-left",
                    deadlockStrategy === "LockOrdering"
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                      : "bg-[#090D16] border-[#1F293D] text-slate-400 hover:text-white"
                  )}
                >
                  <strong className="block mb-1">Strict Lock Ordering</strong>
                  <span className="text-[10px] text-slate-400 font-normal">Both: R1 first, then R2</span>
                </button>
              </div>

              {/* Step Controls */}
              <div className="pt-3 border-t border-[#1F293D] flex items-center gap-3">
                <button
                  onClick={() => setDeadlockStep((s) => Math.min(s + 1, 4))}
                  disabled={deadlockStep >= 4}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs transition-colors min-h-[44px]"
                >
                  Advance Step ({deadlockStep}/4)
                </button>
                <button
                  onClick={() => setDeadlockStep(0)}
                  className="py-2.5 px-4 rounded-lg bg-[#090D16] border border-[#1F293D] hover:bg-slate-800 text-slate-300 text-xs font-medium min-h-[44px]"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Coffman Conditions Checklist */}
            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Coffman's 4 Necessary Conditions
              </h3>
              <p className="text-xs text-slate-400">
                Deadlock can <b>ONLY</b> occur if all four conditions hold simultaneously:
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#090D16] border border-[#1F293D]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <strong className="text-slate-200 block">1. Mutual Exclusion</strong>
                    <span className="text-slate-400">Resources (R1, R2) are non-shareable; only one thread holds them.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#090D16] border border-[#1F293D]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <strong className="text-slate-200 block">2. Hold and Wait</strong>
                    <span className="text-slate-400">Threads hold an allocated resource while requesting another.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#090D16] border border-[#1F293D]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <strong className="text-slate-200 block">3. No Preemption</strong>
                    <span className="text-slate-400">Resources cannot be forcibly confiscated from running threads.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#090D16] border border-[#1F293D]">
                  {deadlockStrategy === "Dangerous" ? (
                    <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs">
                    <strong className="text-slate-200 block">4. Circular Wait</strong>
                    <span className="text-slate-400">
                      {deadlockStrategy === "Dangerous"
                        ? "Present! T1 waits for T2 to release R2, while T2 waits for T1 to release R1."
                        : "ELIMINATED! Strict total lock ordering guarantees no cycle can ever form."}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (7 cols): Resource Allocation Graph */}
          <div className="lg:col-span-7 flex flex-col gap-5 overflow-y-auto">
            {/* Status Callout */}
            {deadlockStatus.isDeadlocked ? (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500 text-rose-300 flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
                <div className="text-xs">
                  <strong className="text-sm font-bold text-white block">DEADLOCK CONFIRMED: SYSTEM FROZEN!</strong>
                  Cycle detected in Resource Allocation Graph: T1 holds R1 & wants R2, T2 holds R2 & wants R1. Neither can proceed.
                </div>
              </div>
            ) : deadlockStatus.isResolved ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500 text-emerald-300 flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                <div className="text-xs">
                  <strong className="text-sm font-bold text-white block">SAFE: DEADLOCK PREVENTED!</strong>
                  Because both threads follow identical lock order (R1 then R2), T2 waited cleanly without holding any conflicting resource.
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs">
                Step <strong>{deadlockStep}</strong>: Click <b>Advance Step</b> to watch threads request and hold locks.
              </div>
            )}

            {/* Interactive Graph Box */}
            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-6 flex flex-col gap-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Resource Allocation Graph (RAG)
              </h3>

              <div className="grid grid-cols-2 gap-8 py-4">
                {/* Thread 1 Node */}
                <div className={cn(
                  "p-4 rounded-xl border flex flex-col items-center gap-2 text-center",
                  deadlockStatus.isDeadlocked ? "bg-rose-500/20 border-rose-500" : "bg-[#090D16] border-[#1F293D]"
                )}>
                  <span className="w-3 h-3 rounded-full bg-indigo-500" />
                  <strong className="text-sm text-white">Thread T1</strong>
                  <span className="text-[11px] text-slate-400">
                    Holds: <strong className="text-emerald-400 font-mono">{deadlockStatus.t1Holds || "None"}</strong>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Wants: <strong className="text-amber-400 font-mono">{deadlockStatus.t1Wants || "None"}</strong>
                  </span>
                </div>

                {/* Resource R1 Node */}
                <div className="p-4 rounded-xl border bg-[#090D16] border-[#1F293D] flex flex-col items-center gap-2 text-center">
                  <Lock className="w-5 h-5 text-emerald-400" />
                  <strong className="text-sm text-white">Resource R1 (Mutex)</strong>
                  <span className="text-[11px] text-slate-400">
                    Owner: <strong className="text-white font-mono">{deadlockStatus.t1Holds === "R1" ? "T1" : "Free"}</strong>
                  </span>
                </div>

                {/* Resource R2 Node */}
                <div className="p-4 rounded-xl border bg-[#090D16] border-[#1F293D] flex flex-col items-center gap-2 text-center">
                  <Lock className="w-5 h-5 text-amber-400" />
                  <strong className="text-sm text-white">Resource R2 (Mutex)</strong>
                  <span className="text-[11px] text-slate-400">
                    Owner: <strong className="text-white font-mono">{deadlockStatus.t2Holds === "R2" ? "T2" : "Free"}</strong>
                  </span>
                </div>

                {/* Thread 2 Node */}
                <div className={cn(
                  "p-4 rounded-xl border flex flex-col items-center gap-2 text-center",
                  deadlockStatus.isDeadlocked ? "bg-rose-500/20 border-rose-500" : "bg-[#090D16] border-[#1F293D]"
                )}>
                  <span className="w-3 h-3 rounded-full bg-pink-500" />
                  <strong className="text-sm text-white">Thread T2</strong>
                  <span className="text-[11px] text-slate-400">
                    Holds: <strong className="text-emerald-400 font-mono">{deadlockStatus.t2Holds || "None"}</strong>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Wants: <strong className="text-amber-400 font-mono">{deadlockStatus.t2Wants || "None"}</strong>
                  </span>
                </div>
              </div>

              {/* Edge description */}
              <div className="bg-[#090D16] p-4 rounded-lg border border-[#1F293D] text-xs text-slate-400 space-y-1">
                <div><b>Graph Cycle Analysis:</b></div>
                {deadlockStrategy === "Dangerous" ? (
                  <p>
                    {deadlockStep === 0 && "Initial state: Both resources are free."}
                    {deadlockStep === 1 && "Edge: T1 -> R1 (Allocation: R1 assigned to T1)."}
                    {deadlockStep === 2 && "Edge: T2 -> R2 (Allocation: R2 assigned to T2)."}
                    {deadlockStep === 3 && "Edge: T1 -> R2 (Request: T1 waits for R2 held by T2)."}
                    {deadlockStep >= 4 && "Edge: T2 -> R1 (Request: T2 waits for R1 held by T1). CYCLIC DEPENDENCY FORMED: T1 -> R2 -> T2 -> R1 -> T1!"}
                  </p>
                ) : (
                  <p>
                    {deadlockStep < 2 && "Both threads obey Lock Ordering: must acquire R1 before R2."}
                    {deadlockStep >= 2 && "T2 tries to get R1 first. Since T1 already holds R1, T2 blocks before grabbing R2. No cycle can ever exist!"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
