import { useState, useMemo } from "react";
import { AlertCircle, Layers, CheckCircle2, ShieldAlert } from "lucide-react";
import { cn } from "../../lib/utils";

const MAX_OFFSET = 4096; // 12 bits
const PHY_SIZE = 65536; // 16 bits (64KB)

export function AddressTranslation() {
  const [vaInput, setVaInput] = useState<number>(1024);

  const [segments, setSegments] = useState([
    { id: 0, name: "Code", base: 32768, bounds: 2048, growsNegative: false, color: "#6366F1" },
    { id: 1, name: "Heap", base: 36864, bounds: 3072, growsNegative: false, color: "#10B981" },
    { id: 2, name: "Stack", base: 28672, bounds: 2048, growsNegative: true, color: "#F59E0B" },
  ]);

  const updateSegment = (id: number, field: string, value: number | boolean) => {
    setSegments(segments.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const translation = useMemo(() => {
    const va = Math.min(Math.max(0, isNaN(vaInput) ? 0 : vaInput), 16383); // 14 bit max
    const segBits = (va & 0x3000) >> 12;
    const offset = va & 0x0FFF;

    if (segBits === 3) {
      return { va, segBits, offset, valid: false, reason: "Illegal Segment (11 - Unallocated space)", segName: "Unused" };
    }

    const seg = segments[segBits];
    let pa = 0;
    let valid = true;
    let reason = "";

    if (seg.growsNegative) {
      const negativeOffset = offset - MAX_OFFSET;
      if (Math.abs(negativeOffset) > seg.bounds) {
        valid = false;
        reason = `Segmentation Fault: Negative offset exceeds bounds. |${negativeOffset}| > ${seg.bounds}`;
      } else {
        pa = seg.base + negativeOffset;
      }
    } else {
      if (offset >= seg.bounds) {
        valid = false;
        reason = `Segmentation Fault: Offset ${offset} exceeds bounds ${seg.bounds}`;
      } else {
        pa = seg.base + offset;
      }
    }

    if (pa < 0 || pa >= PHY_SIZE) {
      valid = false;
      reason = "Segmentation Fault: Physical address out of 64KB physical RAM bounds";
    }

    return { va, segBits, offset, pa, valid, reason, segName: seg.name };
  }, [vaInput, segments]);

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <Layers className="w-7 h-7 text-indigo-400" />
          Address Translation & Segmentation
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>OSTEP Chapters 15 & 16</span>
          <span aria-hidden="true">·</span>
          <span>Base and Bounds Hardware Translation</span>
          <span aria-hidden="true">·</span>
          <span>Segmentation & Fault Protection</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Controls Column (5 cols) */}
        <div className="lg:col-span-5 bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-5 overflow-y-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Segment Registers</h3>

          <div className="space-y-3.5">
            {segments.map((seg) => (
              <div key={seg.id} className="bg-[#080C14] p-4 rounded-lg border border-[#1F293D] space-y-3">
                <div className="flex items-center justify-between border-b border-[#1F293D] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                    <span className="font-semibold text-xs text-slate-200">
                      Segment {seg.id}: {seg.name}
                    </span>
                  </div>
                  <label className="text-[11px] font-medium flex items-center gap-2 text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={seg.growsNegative}
                      onChange={(e) => updateSegment(seg.id, "growsNegative", e.target.checked)}
                      className="rounded bg-[#121826] border-[#1F293D] accent-indigo-500 w-3.5 h-3.5"
                    />
                    Grows Negative (Stack)
                  </label>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Base Address</span>
                    <span className="font-mono text-indigo-400 font-semibold">{seg.base} (0x{seg.base.toString(16).toUpperCase()})</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={PHY_SIZE - 4096}
                    step="1024"
                    value={seg.base}
                    onChange={(e) => updateSegment(seg.id, "base", Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Bounds (Limit)</span>
                    <span className="font-mono text-emerald-400 font-semibold">{seg.bounds} B</span>
                  </div>
                  <input
                    type="range"
                    min="256"
                    max={MAX_OFFSET}
                    step="256"
                    value={seg.bounds}
                    onChange={(e) => updateSegment(seg.id, "bounds", Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Visualizer Column (7 cols) */}
        <div className="lg:col-span-7 bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-5 overflow-y-auto">
          {/* Virtual Address Input Box */}
          <div className="bg-[#080C14] p-5 rounded-lg border border-[#1F293D] flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Virtual Address Decoder (14-bit Address Space)
            </h3>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[140px]">
                <label className="text-xs text-slate-400 block mb-1">Decimal Virtual Address</label>
                <input
                  type="number"
                  value={vaInput}
                  onChange={(e) => setVaInput(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-[#121826] border border-[#1F293D] rounded-lg px-3 py-2 text-white font-mono text-base focus:outline-none focus:border-indigo-500 min-h-[44px]"
                  min="0"
                  max="16383"
                />
              </div>

              <div className="bg-[#121826] border border-[#1F293D] rounded-lg px-4 py-2.5 flex flex-col">
                <span className="text-[10px] text-slate-400">Hexadecimal</span>
                <span className="text-sm font-mono font-bold text-slate-200">
                  0x{vaInput.toString(16).padStart(4, "0").toUpperCase()}
                </span>
              </div>
            </div>

            {/* Bit Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
              <div className="bg-[#121826] border border-[#1F293D] rounded-lg p-3 flex flex-col">
                <span className="text-[11px] text-slate-400 mb-1">Segment Bits (Top 2 bits [13:12])</span>
                <span className="text-base font-mono font-bold text-indigo-400">
                  {translation.segBits.toString(2).padStart(2, "0")} · {translation.segName}
                </span>
              </div>
              <div className="bg-[#121826] border border-[#1F293D] rounded-lg p-3 flex flex-col">
                <span className="text-[11px] text-slate-400 mb-1">Offset (Bottom 12 bits [11:0])</span>
                <span className="text-base font-mono font-bold text-emerald-400">
                  {translation.offset} (0x{translation.offset.toString(16).toUpperCase()})
                </span>
              </div>
            </div>

            {/* Translation Result Card */}
            <div
              className={cn(
                "p-5 rounded-lg border flex flex-col items-center justify-center min-h-[110px] text-center transition-all",
                translation.valid
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-rose-500/10 border-rose-500/40"
              )}
            >
              {translation.valid ? (
                <>
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Physical Translation Valid
                  </div>
                  <div className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
                    PA: {translation.pa}{" "}
                    <span className="text-sm text-slate-400 font-normal">
                      (0x{translation.pa.toString(16).padStart(4, "0").toUpperCase()})
                    </span>
                  </div>
                  <div className="text-xs font-mono text-indigo-300 mt-1">
                    Base ({segments[translation.segBits]?.base}) + Offset ({translation.offset}) = {translation.pa}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-rose-300">
                  <ShieldAlert className="w-6 h-6 text-rose-400" />
                  <span className="text-sm font-bold text-white">HARDWARE EXCEPTION (SIGSEGV)</span>
                  <span className="text-xs font-mono text-rose-300/90">{translation.reason}</span>
                </div>
              )}
            </div>
          </div>

          {/* Memory Visual Maps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-64 mt-2">
            {/* Virtual Address Space */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-slate-400 text-center">Virtual Address Space (16 KB)</span>
              <div className="flex-1 relative border border-[#1F293D] bg-[#080C14] rounded-lg flex flex-col justify-between p-2 gap-1.5">
                <div className="h-1/4 w-full bg-indigo-500/10 border border-indigo-500/30 rounded flex items-center justify-between px-3">
                  <span className="text-xs font-semibold text-indigo-300">00: Code</span>
                  <span className="text-[10px] font-mono text-slate-400">0–4 KB</span>
                </div>
                <div className="h-1/4 w-full bg-emerald-500/10 border border-emerald-500/30 rounded flex items-center justify-between px-3">
                  <span className="text-xs font-semibold text-emerald-300">01: Heap</span>
                  <span className="text-[10px] font-mono text-slate-400">4–8 KB</span>
                </div>
                <div className="h-1/4 w-full border border-dashed border-[#1F293D] rounded flex items-center justify-center opacity-40">
                  <span className="text-xs text-slate-500">10: Unused Space</span>
                </div>
                <div className="h-1/4 w-full bg-amber-500/10 border border-amber-500/30 rounded flex items-center justify-between px-3">
                  <span className="text-xs font-semibold text-amber-300">11: Stack</span>
                  <span className="text-[10px] font-mono text-slate-400">12–16 KB</span>
                </div>
              </div>
            </div>

            {/* Physical Memory */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-slate-400 text-center">Physical RAM (64 KB)</span>
              <div className="flex-1 relative border border-[#1F293D] bg-[#080C14] rounded-lg overflow-hidden">
                {segments.map((seg) => {
                  const top = (seg.base / PHY_SIZE) * 100;
                  const height = (seg.bounds / PHY_SIZE) * 100;
                  const actTop = seg.growsNegative ? ((seg.base - seg.bounds) / PHY_SIZE) * 100 : top;

                  return (
                    <div
                      key={seg.id}
                      className="absolute w-full border-y border-[#1F293D] flex flex-col justify-center items-center px-2"
                      style={{
                        top: `${actTop}%`,
                        height: `${height}%`,
                        minHeight: "24px",
                        backgroundColor: `${seg.color}15`,
                        borderLeftColor: seg.color,
                        borderLeftWidth: "3px",
                      }}
                    >
                      <span className="text-[10px] font-semibold" style={{ color: seg.color }}>
                        {seg.name} ({seg.bounds}B)
                      </span>
                    </div>
                  );
                })}

                {translation.valid && (
                  <div
                    className="absolute w-full h-[2px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] z-10"
                    style={{ top: `${(translation.pa / PHY_SIZE) * 100}%` }}
                  >
                    <div className="absolute right-2 -translate-y-1/2 text-white font-mono text-[10px] font-bold bg-[#090D16] px-1 rounded border border-[#1F293D]">
                      PA: {translation.pa}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
