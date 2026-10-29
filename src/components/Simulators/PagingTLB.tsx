import { useState, useRef } from "react";
import { Play, RotateCcw, Cpu, Layers, HelpCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "../../lib/utils";

interface TLBEntry {
  vpn: number;
  pfn: number;
  asid: number;
  valid: boolean;
  lastUsed: number;
  insertedAt: number;
}

export function PagingTLB() {
  const [vaInput, setVaInput] = useState(1024);
  const [asid, setAsid] = useState(1);
  const [tlbPolicy, setTlbPolicy] = useState<"LRU" | "FIFO">("LRU");

  // State for visualizer
  const [step, setStep] = useState(0); // 0: Start, 1: Extract VPN/Offset, 2: TLB Lookup, 3: Page Directory, 4: Page Table, 5: PA Calc
  const [logs, setLogs] = useState<string[]>([
    "Ready. Enter a Virtual Address and click Start Translation or Step Forward.",
  ]);

  const [tlb, setTlb] = useState<TLBEntry[]>([
    { vpn: 16, pfn: 4, asid: 1, valid: true, lastUsed: 1, insertedAt: 1 },
    { vpn: 32, pfn: 8, asid: 1, valid: true, lastUsed: 2, insertedAt: 2 },
    { vpn: 0, pfn: 0, asid: 0, valid: false, lastUsed: 0, insertedAt: 0 },
    { vpn: 0, pfn: 0, asid: 0, valid: false, lastUsed: 0, insertedAt: 0 },
  ]);
  const counterRef = useRef(3);

  const getPfn = (vpn: number, currentAsid: number) => {
    return (vpn * 13 + currentAsid * 7) % 64; // 6 bits PFN
  };

  const addLog = (msg: string) => setLogs((prev) => [...prev, msg].slice(-8));

  const handleStep = () => {
    counterRef.current++;
    const vpn = (vaInput & 0x3fc0) >> 6; // 8 bits
    const offset = vaInput & 0x003f; // 6 bits

    if (step === 0) {
      addLog(`Step 1: Extracted VPN = 0x${vpn.toString(16).toUpperCase()} (${vpn}), Offset = 0x${offset.toString(16).toUpperCase()} (${offset})`);
      setStep(1);
    } else if (step === 1) {
      addLog(`Step 2: Probing TLB cache for VPN ${vpn} (ASID: ${asid})...`);
      setStep(2);
    } else if (step === 2) {
      const hitIndex = tlb.findIndex((e) => e.valid && e.vpn === vpn && e.asid === asid);
      if (hitIndex !== -1) {
        addLog(`Step 3: TLB CACHE HIT! Translation fast-path resolved PFN = ${tlb[hitIndex].pfn}. No memory access required.`);
        const newTlb = [...tlb];
        newTlb[hitIndex] = { ...newTlb[hitIndex], lastUsed: counterRef.current };
        setTlb(newTlb);
        setStep(5); // Skip directly to PA calc
      } else {
        addLog(`Step 3: TLB CACHE MISS! Walking two-level hierarchical page table in main RAM...`);
        setStep(3);
      }
    } else if (step === 3) {
      const pdi = (vpn & 0xf0) >> 4;
      addLog(`Step 4: Looking up Page Directory Index (PDI) = ${pdi} via CR3 register. PDE found valid.`);
      setStep(4);
    } else if (step === 4) {
      const pti = vpn & 0x0f;
      const pfn = getPfn(vpn, asid);
      addLog(`Step 5: Looking up Page Table Index (PTI) = ${pti}. PTE valid -> PFN = ${pfn}.`);

      // Insert into TLB
      const newTlb = [...tlb];
      let replaceIdx = newTlb.findIndex((e) => !e.valid);
      if (replaceIdx === -1) {
        if (tlbPolicy === "LRU") {
          let minUsed = Infinity;
          newTlb.forEach((e, i) => {
            if (e.lastUsed < minUsed) {
              minUsed = e.lastUsed;
              replaceIdx = i;
            }
          });
        } else {
          let minIns = Infinity;
          newTlb.forEach((e, i) => {
            if (e.insertedAt < minIns) {
              minIns = e.insertedAt;
              replaceIdx = i;
            }
          });
        }
      }
      newTlb[replaceIdx] = {
        vpn,
        pfn,
        asid,
        valid: true,
        lastUsed: counterRef.current,
        insertedAt: counterRef.current,
      };
      setTlb(newTlb);
      addLog(`TLB Updated: Cached VPN ${vpn} -> PFN ${pfn} (${tlbPolicy} replacement).`);
      setStep(5);
    } else if (step === 5) {
      const pfn = getPfn(vpn, asid);
      const pa = (pfn << 6) | offset;
      addLog(`Step 6: Translation Complete. Physical Address = 0x${pa.toString(16).toUpperCase()} (${pa}).`);
      setStep(6);
    } else {
      setStep(0);
      setLogs(["Ready. Enter a Virtual Address and click Start Translation."]);
    }
  };

  const handleReset = () => {
    setStep(0);
    setLogs(["Reset translation walk state."]);
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <Cpu className="w-7 h-7 text-indigo-400" />
          Paging & Translation Lookaside Buffer (TLB)
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>OSTEP Chapters 18–20</span>
          <span aria-hidden="true">·</span>
          <span>Multi-Level Page Tables</span>
          <span aria-hidden="true">·</span>
          <span>Hardware TLB Hit/Miss & Address Space IDs (ASID)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Controls Column (4 cols) */}
        <div className="lg:col-span-4 bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-5 overflow-y-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Address & Process Config</h3>

          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">Virtual Address (14-bit: 0–16383)</label>
              <input
                type="number"
                value={vaInput}
                onChange={(e) => {
                  setVaInput(parseInt(e.target.value) || 0);
                  handleReset();
                }}
                min="0"
                max="16383"
                className="bg-[#080C14] border border-[#1F293D] rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500 min-h-[44px]"
              />
              <span className="text-[11px] font-mono text-slate-400">
                0x{vaInput.toString(16).padStart(4, "0").toUpperCase()}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">Process Address Space ID (ASID)</label>
              <div className="flex bg-[#080C14] rounded-lg p-1 border border-[#1F293D]">
                <button
                  onClick={() => {
                    setAsid(1);
                    handleReset();
                  }}
                  className={cn(
                    "flex-1 py-2 text-xs font-semibold rounded-md transition-colors min-h-[38px]",
                    asid === 1 ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  Process 1 (ASID: 1)
                </button>
                <button
                  onClick={() => {
                    setAsid(2);
                    handleReset();
                  }}
                  className={cn(
                    "flex-1 py-2 text-xs font-semibold rounded-md transition-colors min-h-[38px]",
                    asid === 2 ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  Process 2 (ASID: 2)
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">TLB Replacement Policy</label>
              <select
                value={tlbPolicy}
                onChange={(e) => setTlbPolicy(e.target.value as "LRU" | "FIFO")}
                className="bg-[#080C14] border border-[#1F293D] rounded-lg px-3 py-2 text-white text-xs font-medium focus:outline-none focus:border-indigo-500 min-h-[44px]"
              >
                <option value="LRU">Least Recently Used (LRU)</option>
                <option value="FIFO">First In, First Out (FIFO)</option>
              </select>
            </div>

            <div className="pt-3 border-t border-[#1F293D] flex flex-col gap-2.5">
              <button
                onClick={handleStep}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg transition-colors text-xs font-semibold flex items-center justify-center gap-2 min-h-[44px]"
              >
                <Play className="w-4 h-4" />
                {step === 0 ? "Start Translation Walk" : step === 6 ? "Restart Translation" : "Step Forward"}
              </button>
              <button
                onClick={handleReset}
                className="w-full bg-[#080C14] hover:bg-slate-800 text-slate-300 border border-[#1F293D] px-4 py-2.5 rounded-lg transition-colors text-xs font-semibold flex items-center justify-center gap-2 min-h-[44px]"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Step State
              </button>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-[#1F293D] text-xs text-slate-400 space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-indigo-400">
              <HelpCircle className="w-3.5 h-3.5" />
              TLB Mechanics
            </div>
            <p>
              The <b>TLB (Translation Lookaside Buffer)</b> is a fast MMU cache. On a hit, physical address calculation takes 1 cycle. On a miss, the CPU must incur memory accesses to traverse the page directory and page table.
            </p>
          </div>
        </div>

        {/* Visualizer Column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-5 overflow-y-auto">
          {/* Top Row: Virtual Address Decoding & TLB */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Virtual Address Decoded */}
            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Virtual Address Decomposition
              </h3>

              <div className="bg-[#080C14] rounded-lg border border-[#1F293D] p-4 flex flex-col items-center justify-center gap-3">
                <div className="flex items-center gap-2 font-mono">
                  <div
                    className={cn(
                      "px-3 py-2 border rounded-lg text-lg tracking-widest transition-colors",
                      step >= 1 ? "border-indigo-500 text-indigo-300 bg-indigo-500/10" : "border-[#1F293D] text-slate-600"
                    )}
                  >
                    {((vaInput & 0x3fc0) >> 6).toString(2).padStart(8, "0")}
                  </div>
                  <div
                    className={cn(
                      "px-3 py-2 border rounded-lg text-lg tracking-widest transition-colors",
                      step >= 1 ? "border-emerald-500 text-emerald-300 bg-emerald-500/10" : "border-[#1F293D] text-slate-600"
                    )}
                  >
                    {(vaInput & 0x003f).toString(2).padStart(6, "0")}
                  </div>
                </div>
                <div className="flex w-full px-2 text-[11px] text-slate-400 justify-between font-mono">
                  <span>VPN (8-bit): {((vaInput & 0x3fc0) >> 6)}</span>
                  <span>Offset (6-bit): {(vaInput & 0x003f)}</span>
                </div>
              </div>

              {/* Progress Stepper Indicator */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-[#1F293D]">
                <span>Stage: {step === 0 ? "Initial" : step === 1 ? "Extracted" : step === 2 ? "TLB Lookup" : step === 3 ? "PDI Lookup" : step === 4 ? "PTI Lookup" : step === 5 ? "PA Computed" : "Finished"}</span>
                <span className="font-mono text-indigo-400">Step {step}/6</span>
              </div>
            </div>

            {/* Hardware TLB Cache Table */}
            <div
              className={cn(
                "bg-[#121826] border rounded-xl p-5 flex flex-col gap-3 transition-all",
                step === 2 || step === 5 ? "border-indigo-500 ring-1 ring-indigo-500/40" : "border-[#1F293D]"
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  Hardware TLB (4 Entries)
                </h3>
                <span className="text-[11px] text-slate-400">{tlbPolicy}</span>
              </div>

              <div className="flex flex-col gap-1.5 overflow-x-auto">
                <div className="grid grid-cols-4 text-[10px] text-slate-400 font-semibold px-2 uppercase tracking-wider text-center">
                  <span>VPN</span>
                  <span>PFN</span>
                  <span>ASID</span>
                  <span>Valid</span>
                </div>
                {tlb.map((entry, i) => (
                  <div
                    key={i}
                    className={cn(
                      "grid grid-cols-4 text-center text-xs font-mono p-2.5 rounded-lg border",
                      !entry.valid
                        ? "bg-[#080C14] border-[#1F293D] text-slate-600"
                        : entry.asid === asid
                        ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-200"
                        : "bg-[#080C14] border-[#1F293D] text-slate-400"
                    )}
                  >
                    <span>{entry.valid ? entry.vpn : "—"}</span>
                    <span>{entry.valid ? entry.pfn : "—"}</span>
                    <span>{entry.valid ? entry.asid : "—"}</span>
                    <span className={entry.valid ? "text-emerald-400 font-bold" : ""}>
                      {entry.valid ? "1" : "0"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Row: Page Table Walk & Live Log */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Hierarchical Page Table Walk */}
            <div
              className={cn(
                "bg-[#121826] border rounded-xl p-5 flex flex-col gap-4 transition-all",
                step === 3 || step === 4 ? "border-emerald-500 ring-1 ring-emerald-500/40" : "border-[#1F293D]"
              )}
            >
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                Two-Level Page Table Walk
              </h3>

              <div className="flex flex-col gap-3">
                {/* Level 1: Page Directory */}
                <div
                  className={cn(
                    "p-3 rounded-lg border text-center transition-colors",
                    step >= 3 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-[#080C14] border-[#1F293D] text-slate-500"
                  )}
                >
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Page Directory (CR3)</div>
                  <div className="font-mono text-xs font-bold mt-0.5">
                    PDI: {step >= 3 ? (vaInput & 0x3fc0) >> 10 : "—"}
                  </div>
                </div>

                <div className="flex justify-center text-slate-500">
                  <ArrowRight className="w-4 h-4 rotate-90" />
                </div>

                {/* Level 2: Page Table */}
                <div
                  className={cn(
                    "p-3 rounded-lg border text-center transition-colors",
                    step >= 4 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-[#080C14] border-[#1F293D] text-slate-500"
                  )}
                >
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Page Table Entry (PTE)</div>
                  <div className="font-mono text-xs font-bold mt-0.5">
                    PTI: {step >= 4 ? ((vaInput & 0x03c0) >> 6) : "—"} · PFN: {step >= 4 ? getPfn((vaInput & 0x3fc0) >> 6, asid) : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Translation Walk Log */}
            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Step-by-Step Translation Log
              </h3>
              <div className="flex flex-col gap-2 overflow-y-auto max-h-56 pr-1">
                {logs.map((l, i) => (
                  <div
                    key={i}
                    className="text-xs font-mono text-slate-300 bg-[#080C14] p-2.5 rounded-lg border border-[#1F293D]"
                  >
                    {l}
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
