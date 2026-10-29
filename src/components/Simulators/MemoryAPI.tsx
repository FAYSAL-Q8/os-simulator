import { useState } from "react";
import { AlertCircle, Plus, Trash2, Edit3, Eye, MemoryStick, HelpCircle } from "lucide-react";
import { cn } from "../../lib/utils";

interface Pointer {
  id: string;
  name: string;
  targetId: string | null;
}

interface Block {
  id: string;
  size: number;
  allocated: boolean;
  data: string;
}

export function MemoryAPI() {
  const [pointers, setPointers] = useState<Pointer[]>([
    { id: "ptr-1", name: "ptr1", targetId: "block-1" },
  ]);
  const [heap, setHeap] = useState<Block[]>([
    { id: "block-1", size: 32, allocated: true, data: "UserSessionToken" },
  ]);
  const [pointerCounter, setPointerCounter] = useState(2);
  const [blockCounter, setBlockCounter] = useState(2);
  const [logs, setLogs] = useState<{ id: number; message: string; type: "info" | "error" | "warning" }[]>([
    { id: 1, message: "Initialized stack with ptr1 pointing to heap block-1 (32 bytes).", type: "info" },
  ]);
  const [logCounter, setLogCounter] = useState(2);

  const [allocSize, setAllocSize] = useState(16);
  const [selectedPointerId, setSelectedPointerId] = useState<string>("ptr-1");
  const [writeContent, setWriteContent] = useState("Hello Kernel");

  const addLog = (message: string, type: "info" | "error" | "warning" = "info") => {
    setLogs((prev) => [{ id: logCounter, message, type }, ...prev].slice(0, 10));
    setLogCounter((c) => c + 1);
  };

  const handleCreatePointer = () => {
    const newPtr = { id: `ptr-${pointerCounter}`, name: `ptr${pointerCounter}`, targetId: null };
    setPointers([...pointers, newPtr]);
    setPointerCounter((c) => c + 1);
    if (!selectedPointerId) setSelectedPointerId(newPtr.id);
    addLog(`Created uninitialized pointer ${newPtr.name} on stack.`);
  };

  const handleAllocate = () => {
    if (!selectedPointerId) {
      addLog("Select a pointer first!", "warning");
      return;
    }

    const ptrIndex = pointers.findIndex((p) => p.id === selectedPointerId);
    if (ptrIndex === -1) return;

    const ptr = pointers[ptrIndex];
    if (ptr.targetId) {
      // Memory Leak! We are overwriting a pointer that already points somewhere
      const oldTarget = heap.find((b) => b.id === ptr.targetId);
      if (oldTarget && oldTarget.allocated) {
        addLog(`MEMORY LEAK! Overwriting pointer ${ptr.name} without freeing block ${oldTarget.id}.`, "error");
      }
    }

    const newBlock: Block = { id: `block-${blockCounter}`, size: allocSize, allocated: true, data: "" };
    setHeap([...heap, newBlock]);
    setBlockCounter((c) => c + 1);

    const newPointers = [...pointers];
    newPointers[ptrIndex] = { ...ptr, targetId: newBlock.id };
    setPointers(newPointers);

    addLog(`Allocated ${allocSize} bytes at ${newBlock.id} and assigned to ${ptr.name}.`);
  };

  const handleFree = () => {
    if (!selectedPointerId) return;
    const ptr = pointers.find((p) => p.id === selectedPointerId);
    if (!ptr) return;

    if (!ptr.targetId) {
      addLog(`Pointer ${ptr.name} is null/uninitialized. Cannot free.`, "error");
      return;
    }

    const targetBlockIndex = heap.findIndex((b) => b.id === ptr.targetId);
    if (targetBlockIndex === -1) return;

    const block = heap[targetBlockIndex];
    if (!block.allocated) {
      addLog(`DOUBLE FREE ERROR! Block ${block.id} is already freed!`, "error");
      return;
    }

    const newHeap = [...heap];
    newHeap[targetBlockIndex] = { ...block, allocated: false };
    setHeap(newHeap);
    addLog(`Freed block ${block.id} (pointed to by ${ptr.name}). Note: ${ptr.name} still holds address (Dangling Pointer).`);
  };

  const handleRemovePointer = (id: string) => {
    const ptr = pointers.find((p) => p.id === id);
    if (ptr && ptr.targetId) {
      const block = heap.find((b) => b.id === ptr.targetId);
      if (block && block.allocated) {
        const otherPointers = pointers.filter((p) => p.id !== id && p.targetId === block.id);
        if (otherPointers.length === 0) {
          addLog(`MEMORY LEAK! Pointer ${ptr.name} removed from stack, but block ${block.id} was not freed!`, "error");
        }
      }
    }
    setPointers(pointers.filter((p) => p.id !== id));
    if (selectedPointerId === id) setSelectedPointerId("");
    addLog(`Removed pointer ${ptr?.name} from stack.`);
  };

  const handleWrite = () => {
    if (!selectedPointerId) return;
    const ptr = pointers.find((p) => p.id === selectedPointerId);
    if (!ptr) return;

    if (!ptr.targetId) {
      addLog(`SEGMENTATION FAULT! Attempted to write to uninitialized pointer ${ptr.name}.`, "error");
      return;
    }

    const targetBlockIndex = heap.findIndex((b) => b.id === ptr.targetId);
    if (targetBlockIndex === -1) return;

    const block = heap[targetBlockIndex];
    if (!block.allocated) {
      addLog(`USE AFTER FREE! Dangling pointer ${ptr.name} wrote to freed block ${block.id}.`, "error");
    } else {
      addLog(`Wrote to ${ptr.name} (block ${block.id}).`);
    }

    const newHeap = [...heap];
    newHeap[targetBlockIndex] = { ...block, data: writeContent };
    setHeap(newHeap);
  };

  const handleRead = () => {
    if (!selectedPointerId) return;
    const ptr = pointers.find((p) => p.id === selectedPointerId);
    if (!ptr) return;

    if (!ptr.targetId) {
      addLog(`SEGMENTATION FAULT! Attempted to read from uninitialized pointer ${ptr.name}.`, "error");
      return;
    }

    const block = heap.find((b) => b.id === ptr.targetId);
    if (!block) return;

    if (!block.allocated) {
      addLog(`USE AFTER FREE (Read)! Dangling pointer ${ptr.name} read from freed block ${block.id}. Data: "${block.data}"`, "error");
    } else {
      addLog(`Read from ${ptr.name} (block ${block.id}): "${block.data}"`);
    }
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <MemoryStick className="w-7 h-7 text-indigo-400" />
          Memory API Simulator
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>OSTEP Chapter 14</span>
          <span aria-hidden="true">·</span>
          <span>Dynamic Memory Allocation</span>
          <span aria-hidden="true">·</span>
          <span>malloc, free, Leaks, Dangling Pointers & Use-After-Free</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Controls Column (5 cols) */}
        <div className="lg:col-span-5 bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-5 overflow-y-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Memory Operations</h3>

          <div className="space-y-4">
            <button
              onClick={handleCreatePointer}
              className="w-full flex items-center justify-center gap-2 bg-[#090D16] hover:bg-slate-800 text-slate-200 hover:text-white px-4 py-2.5 rounded-lg transition-colors text-xs font-semibold border border-[#1F293D] min-h-[44px]"
            >
              <Plus className="w-4 h-4 text-indigo-400" />
              Declare Pointer on Stack
            </button>

            {pointers.length > 0 && (
              <div className="space-y-4 pt-3 border-t border-[#1F293D]">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400">Target Stack Pointer</label>
                  <select
                    className="w-full bg-[#080C14] border border-[#1F293D] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 min-h-[44px]"
                    value={selectedPointerId}
                    onChange={(e) => setSelectedPointerId(e.target.value)}
                  >
                    {pointers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.targetId ? `(-> ${p.targetId})` : "(null)"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400">Size to malloc</label>
                    <input
                      type="number"
                      min="1"
                      max="128"
                      value={allocSize}
                      onChange={(e) => setAllocSize(Number(e.target.value))}
                      className="bg-[#080C14] border border-[#1F293D] rounded-lg px-3 py-2 text-xs text-white font-mono min-h-[44px]"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleAllocate}
                      className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors text-xs min-h-[44px]"
                    >
                      malloc({allocSize})
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleFree}
                  className="w-full bg-rose-600/90 hover:bg-rose-500 text-white px-4 py-2.5 rounded-lg transition-colors text-xs font-semibold flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <Trash2 className="w-4 h-4" />
                  free(selected)
                </button>

                <div className="pt-3 space-y-3 border-t border-[#1F293D]">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400">Payload to Store</label>
                    <input
                      type="text"
                      value={writeContent}
                      onChange={(e) => setWriteContent(e.target.value)}
                      className="bg-[#080C14] border border-[#1F293D] rounded-lg px-3 py-2 text-xs text-white min-h-[44px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleWrite}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-colors text-xs font-semibold flex items-center justify-center gap-1.5 min-h-[44px]"
                    >
                      <Edit3 className="w-4 h-4" /> Write
                    </button>
                    <button
                      onClick={handleRead}
                      className="bg-[#090D16] border border-[#1F293D] hover:bg-slate-800 text-slate-200 px-4 py-2 rounded-lg transition-colors text-xs font-semibold flex items-center justify-center gap-1.5 min-h-[44px]"
                    >
                      <Eye className="w-4 h-4" /> Read
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error Triggers Guide */}
          <div className="mt-auto pt-4 border-t border-[#1F293D] flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-400">
              <HelpCircle className="w-3.5 h-3.5" />
              Common Memory Bugs
            </div>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4 leading-relaxed">
              <li><b>Memory Leak:</b> Allocate, then remove the pointer from stack.</li>
              <li><b>Dangling Pointer:</b> Free, then Read/Write to the pointer.</li>
              <li><b>Double Free:</b> Call free() twice on same pointer.</li>
              <li><b>Segfault:</b> Create pointer, then Write without malloc.</li>
            </ul>
          </div>
        </div>

        {/* Visualizer Column (7 cols) */}
        <div className="lg:col-span-7 bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-5 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Memory Layout State</h3>
            <span className="text-xs text-slate-400 font-mono">
              {pointers.length} Pointers · {heap.length} Blocks
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Stack */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-slate-300 px-3 py-2 rounded-lg bg-[#080C14] border border-[#1F293D] text-center">
                Stack (Local Pointer Variables)
              </span>
              <div className="border border-dashed border-[#1F293D] rounded-lg p-3 flex flex-col gap-2 min-h-[14rem] bg-[#080C14]">
                {pointers.length === 0 && <p className="text-xs text-slate-500 text-center italic mt-6">Empty Stack</p>}
                {pointers.map((ptr) => (
                  <div
                    key={ptr.id}
                    className={cn(
                      "flex items-center justify-between p-2.5 rounded-lg border transition-all",
                      selectedPointerId === ptr.id
                        ? "bg-indigo-600/15 border-indigo-500/50 shadow-sm"
                        : "bg-[#121826] border-[#1F293D]"
                    )}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-mono font-bold text-indigo-300">{ptr.name}</span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {ptr.targetId ? `-> ${ptr.targetId}` : "NULL"}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemovePointer(ptr.id)}
                      className="text-slate-500 hover:text-rose-400 p-1.5"
                      title="Pop variable from stack"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Heap */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-slate-300 px-3 py-2 rounded-lg bg-[#080C14] border border-[#1F293D] text-center">
                Heap (Dynamically Allocated Blocks)
              </span>
              <div className="border border-dashed border-[#1F293D] rounded-lg p-3 flex flex-col gap-2 min-h-[14rem] bg-[#080C14]">
                {heap.length === 0 && <p className="text-xs text-slate-500 text-center italic mt-6">Empty Heap</p>}
                {heap.map((block) => (
                  <div
                    key={block.id}
                    className={cn(
                      "p-2.5 rounded-lg border flex flex-col gap-1.5",
                      block.allocated
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-rose-500/10 border-rose-500/30 opacity-50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-slate-200 font-semibold">{block.id}</span>
                      <span className="text-[11px] font-mono font-bold text-slate-300">
                        {block.size}B · {block.allocated ? "Allocated" : "Freed"}
                      </span>
                    </div>
                    {block.data && (
                      <div className="bg-[#080C14] border border-[#1F293D] text-[11px] font-mono text-slate-300 p-1.5 rounded truncate">
                        "{block.data}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Execution Log */}
          <div className="flex-1 bg-[#080C14] rounded-lg border border-[#1F293D] p-4 overflow-y-auto flex flex-col min-h-[160px]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-indigo-400" /> Execution Log
            </h4>
            <div className="flex flex-col gap-1.5">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    "text-xs font-mono px-3 py-2 rounded-lg border",
                    log.type === "error"
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                      : log.type === "warning"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                      : "bg-[#121826] border-[#1F293D] text-slate-300"
                  )}
                >
                  <span className="text-slate-500 mr-2">[{log.id.toString().padStart(3, "0")}]</span>
                  {log.message}
                </div>
              ))}
              {logs.length === 0 && <span className="text-xs text-slate-500 italic">No actions recorded yet.</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
