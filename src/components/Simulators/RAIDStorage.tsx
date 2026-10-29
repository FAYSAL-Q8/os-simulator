import { useState } from "react";
import { HardDrive, AlertTriangle, ShieldCheck, RefreshCw, HelpCircle, CheckCircle2, Zap } from "lucide-react";
import { cn } from "../../lib/utils";

export type RAIDLevel = "RAID 0" | "RAID 1" | "RAID 4" | "RAID 5";

interface BlockData {
  label: string;
  val: number; // 8-bit byte for XOR demonstration
  isParity?: boolean;
}

export function RAIDStorage() {
  const [level, setLevel] = useState<RAIDLevel>("RAID 5");
  const [failedDisks, setFailedDisks] = useState<number[]>([]);
  const [writePayload, setWritePayload] = useState<number[]>([0b10110011, 0b11001101, 0b00111100]); // 3 sample bytes

  // 4 Disks layout
  const diskCount = 4;

  const toggleDiskFail = (diskIdx: number) => {
    if (failedDisks.includes(diskIdx)) {
      setFailedDisks(failedDisks.filter((d) => d !== diskIdx));
    } else {
      setFailedDisks([...failedDisks, diskIdx]);
    }
  };

  const handleReset = () => {
    setFailedDisks([]);
  };

  // Generate stripe data based on RAID level
  // Let's create 4 stripes
  const [b0, b1, b2] = writePayload;
  const parityA = b0 ^ b1 ^ b2;
  const [b3, b4, b5] = [0b11110000, 0b00001111, 0b10101010];
  const parityB = b3 ^ b4 ^ b5;

  const diskBlocks: BlockData[][] = Array.from({ length: 4 }, () => []);

  if (level === "RAID 0") {
    // Pure striping across 4 disks
    diskBlocks[0] = [{ label: "A0", val: b0 }, { label: "A4", val: 0b01010101 }];
    diskBlocks[1] = [{ label: "A1", val: b1 }, { label: "A5", val: 0b11111111 }];
    diskBlocks[2] = [{ label: "A2", val: b2 }, { label: "A6", val: 0b00000000 }];
    diskBlocks[3] = [{ label: "A3", val: 0b10101010 }, { label: "A7", val: 0b11001100 }];
  } else if (level === "RAID 1") {
    // Mirroring (Disks 0 & 1 are mirrors, Disks 2 & 3 are mirrors)
    diskBlocks[0] = [{ label: "A0", val: b0 }, { label: "A2", val: b2 }];
    diskBlocks[1] = [{ label: "A0 (Copy)", val: b0 }, { label: "A2 (Copy)", val: b2 }];
    diskBlocks[2] = [{ label: "A1", val: b1 }, { label: "A3", val: 0b11001100 }];
    diskBlocks[3] = [{ label: "A1 (Copy)", val: b1 }, { label: "A3 (Copy)", val: 0b11001100 }];
  } else if (level === "RAID 4") {
    // Dedicated Parity on Disk 3
    diskBlocks[0] = [{ label: "A0", val: b0 }, { label: "B0", val: b3 }];
    diskBlocks[1] = [{ label: "A1", val: b1 }, { label: "B1", val: b4 }];
    diskBlocks[2] = [{ label: "A2", val: b2 }, { label: "B2", val: b5 }];
    diskBlocks[3] = [
      { label: "P(A)", val: parityA, isParity: true },
      { label: "P(B)", val: parityB, isParity: true },
    ];
  } else if (level === "RAID 5") {
    // Rotating Parity
    diskBlocks[0] = [{ label: "A0", val: b0 }, { label: "B0", val: b3 }, { label: "P(C)", val: 0b11001100, isParity: true }];
    diskBlocks[1] = [{ label: "A1", val: b1 }, { label: "P(B)", val: parityB, isParity: true }, { label: "C0", val: 0b01010101 }];
    diskBlocks[2] = [{ label: "A2", val: b2 }, { label: "B1", val: b4 }, { label: "C1", val: 0b00110011 }];
    diskBlocks[3] = [{ label: "P(A)", val: parityA, isParity: true }, { label: "B2", val: b5 }, { label: "C2", val: 0b11110000 }];
  }

  // Fault tolerance evaluation
  const isHealthy = failedDisks.length === 0;
  let canReconstruct = false;
  let dataLost = false;

  if (level === "RAID 0") {
    canReconstruct = false;
    dataLost = failedDisks.length > 0;
  } else if (level === "RAID 1") {
    // Tolerates 1 failure in pair (0,1) and 1 failure in pair (2,3)
    const pair1Dead = failedDisks.includes(0) && failedDisks.includes(1);
    const pair2Dead = failedDisks.includes(2) && failedDisks.includes(3);
    dataLost = pair1Dead || pair2Dead;
    canReconstruct = failedDisks.length > 0 && !dataLost;
  } else if (level === "RAID 4" || level === "RAID 5") {
    // Tolerates exactly 1 failure
    dataLost = failedDisks.length > 1;
    canReconstruct = failedDisks.length === 1;
  }

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <HardDrive className="w-7 h-7 text-indigo-400" />
          RAID Storage & Parity Reconstruction Simulator
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>OSTEP Chapter 38</span>
          <span aria-hidden="true">·</span>
          <span>Striping (RAID 0), Mirroring (RAID 1), Dedicated Parity (RAID 4) & Rotating Parity (RAID 5)</span>
          <span aria-hidden="true">·</span>
          <span>Bitwise XOR Hardware Failure Recovery</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Controls Column (4 cols) */}
        <div className="lg:col-span-4 bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-5 overflow-y-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">RAID Configuration</h3>

          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">RAID Architecture</label>
              <select
                value={level}
                onChange={(e) => {
                  setLevel(e.target.value as RAIDLevel);
                  handleReset();
                }}
                className="bg-[#080C14] border border-[#1F293D] rounded-lg px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500 min-h-[44px]"
              >
                <option value="RAID 0">RAID 0: Striping (Max Speed, No Redundancy)</option>
                <option value="RAID 1">RAID 1: Mirroring (Full Redundancy)</option>
                <option value="RAID 4">RAID 4: Striping + Dedicated Parity Disk</option>
                <option value="RAID 5">RAID 5: Striping + Distributed Rotating Parity</option>
              </select>
            </div>

            <div className="pt-2 border-t border-[#1F293D] flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-300">Simulate Hardware Drive Failures</label>
              <p className="text-[11px] text-slate-400">
                Click any disk button below to pull the drive and test data survival:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map((d) => (
                  <button
                    key={d}
                    onClick={() => toggleDiskFail(d)}
                    className={cn(
                      "py-2.5 px-3 rounded-lg text-xs font-mono font-semibold border transition-all flex items-center justify-between min-h-[44px]",
                      failedDisks.includes(d)
                        ? "bg-rose-500/20 border-rose-500 text-rose-300 shadow-sm"
                        : "bg-[#080C14] border-[#1F293D] text-slate-300 hover:border-slate-500"
                    )}
                  >
                    <span>Disk {d}</span>
                    <span className="text-[10px] uppercase">
                      {failedDisks.includes(d) ? "FAILED" : "OK"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full bg-[#080C14] hover:bg-slate-800 border border-[#1F293D] text-slate-300 py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 min-h-[44px]"
            >
              <RefreshCw className="w-4 h-4 text-slate-400" />
              Restore All Physical Disks
            </button>
          </div>

          <div className="mt-auto pt-4 border-t border-[#1F293D] text-xs text-slate-400 space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-indigo-400">
              <HelpCircle className="w-3.5 h-3.5" />
              RAID Math & Trade-offs
            </div>
            <p>
              • <b>RAID 0:</b> Capacity = $N \cdot B$. Failure of 1 disk loses all stripes.<br />
              • <b>RAID 1:</b> Capacity = $(N/2) \cdot B$. Tolerates half of all drives failing if mirrors survive.<br />
              • <b>RAID 4:</b> Parity disk is an I/O bottleneck on random writes (every write touches parity disk).<br />
              • <b>RAID 5:</b> Solves RAID 4 bottleneck by spreading parity diagonally across all drives!
            </p>
          </div>
        </div>

        {/* Visualizer Column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-5 overflow-y-auto">
          {/* Health & Reconstruction Status Banner */}
          {isHealthy ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="text-xs">
                <strong className="block text-sm font-bold text-white">ARRAY HEALTHY · ALL 4 DRIVES ONLINE</strong>
                All stripe sets and parity blocks verified. Full read/write throughput active.
              </div>
            </div>
          ) : canReconstruct ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500 text-amber-300 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
              <div className="text-xs leading-relaxed">
                <strong className="block text-sm font-bold text-white">DEGRADED MODE · DATA SURVIVED VIA PARITY</strong>
                Disk {failedDisks.join(", ")} is offline. The array reconstructed all missing bits on-the-fly using bitwise XOR parity ($D_k = P \oplus \dots$).
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500 text-rose-300 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
              <div className="text-xs leading-relaxed">
                <strong className="block text-sm font-bold text-white">CATASTROPHIC DATA LOSS!</strong>
                Too many simultaneous disk failures ({failedDisks.length} dead drives). {level} cannot tolerate this failure count; unrecoverable data corruption occurred.
              </div>
            </div>
          )}

          {/* 4 Physical Disks Platter Rack */}
          <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Physical Disk Array (4 SAS / SATA Drives)
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((diskIdx) => {
                const isDead = failedDisks.includes(diskIdx);
                const blocks = diskBlocks[diskIdx] || [];

                return (
                  <div
                    key={diskIdx}
                    className={cn(
                      "rounded-xl border p-3 flex flex-col gap-3 transition-all",
                      isDead
                        ? "bg-rose-500/10 border-rose-500/50 opacity-60"
                        : "bg-[#080C14] border-[#1F293D]"
                    )}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-[#1F293D]">
                      <div className="flex items-center gap-2">
                        <HardDrive className={cn("w-4 h-4", isDead ? "text-rose-400" : "text-indigo-400")} />
                        <span className="text-xs font-bold font-mono text-slate-200">Disk {diskIdx}</span>
                      </div>
                      <span className={cn("text-[9px] font-mono font-bold", isDead ? "text-rose-400" : "text-emerald-400")}>
                        {isDead ? "OFFLINE" : "ONLINE"}
                      </span>
                    </div>

                    {/* Stored blocks */}
                    <div className="flex flex-col gap-2">
                      {blocks.map((blk, i) => (
                        <div
                          key={i}
                          className={cn(
                            "p-2 rounded-lg border text-xs font-mono flex flex-col gap-0.5",
                            blk.isParity
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                              : "bg-[#121826] border-[#1F293D] text-slate-200"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold">{blk.label}</span>
                            <span className="text-[10px] text-slate-400">
                              {blk.isParity ? "Parity" : "Data"}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            0b{blk.val.toString(2).padStart(8, "0")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real-time XOR Parity Reconstruction Box */}
          <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Bitwise XOR Parity Equation (Stripe A)
            </h3>

            <div className="bg-[#080C14] border border-[#1F293D] rounded-lg p-4 flex flex-col gap-2.5 font-mono text-xs">
              <div className="text-slate-400">
                Formula: <span className="text-amber-400 font-bold">P(A) = A0 ⊕ A1 ⊕ A2</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-slate-300 pt-1">
                <div className="bg-[#121826] p-2 rounded border border-[#1F293D]">
                  <span className="text-[10px] text-slate-500 block">A0 (Disk 0)</span>
                  <span className="text-white">0b{b0.toString(2).padStart(8, "0")}</span>
                </div>
                <div className="bg-[#121826] p-2 rounded border border-[#1F293D]">
                  <span className="text-[10px] text-slate-500 block">A1 (Disk 1)</span>
                  <span className="text-white">0b{b1.toString(2).padStart(8, "0")}</span>
                </div>
                <div className="bg-[#121826] p-2 rounded border border-[#1F293D]">
                  <span className="text-[10px] text-slate-500 block">A2 (Disk 2)</span>
                  <span className="text-white">0b{b2.toString(2).padStart(8, "0")}</span>
                </div>
                <div className="bg-[#121826] p-2 rounded border border-[#1F293D]">
                  <span className="text-[10px] text-amber-400 block font-bold">Parity P(A)</span>
                  <span className="text-amber-400 font-bold">0b{parityA.toString(2).padStart(8, "0")}</span>
                </div>
              </div>

              {failedDisks.length === 1 && (level === "RAID 4" || level === "RAID 5") && (
                <div className="pt-2 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    XOR Invariant verified: Any single failed block is regenerated by XORing all surviving data blocks with Parity!
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
