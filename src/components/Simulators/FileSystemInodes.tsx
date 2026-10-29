import { useState } from "react";
import { FolderTree, FileText, Folder, Play, RotateCcw, HelpCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils";

interface Inode {
  inum: number;
  type: "DIR" | "FILE";
  size: number;
  directPointers: number[]; // Block numbers
  indirectPointer: number | null;
}

interface DirEntry {
  name: string;
  inum: number;
}

export function FileSystemInodes() {
  const [activePath, setActivePath] = useState<string>("/home/notes.txt");
  const [traversalStep, setTraversalStep] = useState<number>(0);
  const [traversalLog, setTraversalLog] = useState<string[]>([
    "Click 'Traverse Path' or 'Step Traversal' to trace filesystem resolution from Root Inode 0.",
  ]);

  // Very Simple File System (vsfs) structures
  const [inodeBitmap, setInodeBitmap] = useState<number[]>([1, 1, 1, 1, 0, 0, 0, 0]); // 8 inodes
  const [dataBitmap, setDataBitmap] = useState<number[]>([1, 1, 1, 0, 0, 0, 0, 0]);   // 8 data blocks

  const inodes: Inode[] = [
    { inum: 0, type: "DIR", size: 64, directPointers: [8], indirectPointer: null },       // Root /
    { inum: 1, type: "DIR", size: 64, directPointers: [9], indirectPointer: null },       // /home
    { inum: 2, type: "FILE", size: 256, directPointers: [10], indirectPointer: null },    // /home/notes.txt
    { inum: 3, type: "FILE", size: 128, directPointers: [11], indirectPointer: null },    // /home/todo.txt
  ];

  // Directory entries inside data blocks
  const directoryData: Record<number, DirEntry[]> = {
    8: [
      { name: ".", inum: 0 },
      { name: "..", inum: 0 },
      { name: "home", inum: 1 },
    ],
    9: [
      { name: ".", inum: 1 },
      { name: "..", inum: 0 },
      { name: "notes.txt", inum: 2 },
      { name: "todo.txt", inum: 3 },
    ],
  };

  const fileData: Record<number, string> = {
    10: "Welcome to Operating Systems: Three Easy Pieces (OSTEP). Disk persistence rocks!",
    11: "Finish Scheduling homework, implement lock algorithms.",
  };

  // Traversal steps for /home/notes.txt
  const steps = [
    {
      title: "Step 0: Read Root Inode",
      desc: "Kernel reads Root Inode 0 from Inode Table (block 3). Root is a directory pointing to Data Block 8.",
      targetInode: 0,
      targetDataBlock: 8,
    },
    {
      title: "Step 1: Parse Root Directory Block",
      desc: "Kernel reads Data Block 8. Scans entries ['.', '..', 'home']. Found 'home' mapping to Inode 1.",
      targetInode: 1,
      targetDataBlock: 8,
    },
    {
      title: "Step 2: Read /home Inode",
      desc: "Kernel reads Inode 1 from Inode Table. Inode 1 is a directory pointing to Data Block 9.",
      targetInode: 1,
      targetDataBlock: 9,
    },
    {
      title: "Step 3: Parse /home Directory Block",
      desc: "Kernel reads Data Block 9. Scans entries. Found 'notes.txt' mapping to Inode 2.",
      targetInode: 2,
      targetDataBlock: 9,
    },
    {
      title: "Step 4: Read notes.txt Inode",
      desc: "Kernel reads Inode 2. Found regular file (size=256B) with Direct Pointer pointing to Data Block 10.",
      targetInode: 2,
      targetDataBlock: 10,
    },
    {
      title: "Step 5: Fetch File Content",
      desc: "Kernel reads Data Block 10. File payload successfully loaded into user buffer!",
      targetInode: 2,
      targetDataBlock: 10,
    },
  ];

  const handleStep = () => {
    if (traversalStep < steps.length - 1) {
      const next = traversalStep + 1;
      setTraversalStep(next);
      setTraversalLog((prev) => [steps[next].desc, ...prev]);
    }
  };

  const handleReset = () => {
    setTraversalStep(0);
    setTraversalLog(["Reset path resolution state."]);
  };

  const currentStepData = steps[traversalStep];

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <FolderTree className="w-7 h-7 text-indigo-400" />
          File System Inodes & Directory Traversal
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>OSTEP Chapter 40</span>
          <span aria-hidden="true">·</span>
          <span>Very Simple File System (vsfs) On-Disk Layout</span>
          <span aria-hidden="true">·</span>
          <span>Superblock, Bitmaps, Inodes & Multi-Level Directory Path Resolution</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Controls Column (4 cols) */}
        <div className="lg:col-span-4 bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-5 overflow-y-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Path Lookup Query</h3>

          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">File Path to Resolve</label>
              <input
                type="text"
                value={activePath}
                readOnly
                className="bg-[#080C14] border border-[#1F293D] rounded-lg px-3 py-2 text-white font-mono text-xs cursor-default min-h-[44px]"
              />
              <span className="text-[11px] text-slate-500">Root / -&gt; home/ -&gt; notes.txt</span>
            </div>

            <div className="flex items-center gap-2.5 pt-2 border-t border-[#1F293D]">
              <button
                onClick={handleStep}
                disabled={traversalStep >= steps.length - 1}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-xs flex items-center justify-center gap-2 min-h-[44px]"
              >
                <Play className="w-4 h-4" />
                Step Resolution ({traversalStep}/{steps.length - 1})
              </button>

              <button
                onClick={handleReset}
                className="bg-[#080C14] hover:bg-slate-800 border border-[#1F293D] text-slate-300 py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center min-h-[44px]"
                title="Reset resolution"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Disk Bitmaps */}
          <div className="bg-[#080C14] p-4 rounded-lg border border-[#1F293D] space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">On-Disk Bitmaps</h4>

            <div className="space-y-2 text-xs font-mono">
              <div>
                <span className="text-slate-400 text-[10px] block mb-1">Inode Bitmap (Block 1)</span>
                <div className="flex gap-1.5">
                  {inodeBitmap.map((bit, idx) => (
                    <span
                      key={idx}
                      className={cn(
                        "w-6 h-6 rounded flex items-center justify-center font-bold text-xs",
                        bit ? "bg-indigo-600 text-white" : "bg-[#121826] text-slate-600"
                      )}
                    >
                      {bit}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] block mb-1">Data Bitmap (Block 2)</span>
                <div className="flex gap-1.5">
                  {dataBitmap.map((bit, idx) => (
                    <span
                      key={idx}
                      className={cn(
                        "w-6 h-6 rounded flex items-center justify-center font-bold text-xs",
                        bit ? "bg-emerald-600 text-white" : "bg-[#121826] text-slate-600"
                      )}
                    >
                      {bit}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-[#1F293D] text-xs text-slate-400 space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-indigo-400">
              <HelpCircle className="w-3.5 h-3.5" />
              vsfs File System Design
            </div>
            <p>
              • <b>Superblock:</b> Contains magic number, total inodes, and data blocks.<br />
              • <b>Inodes:</b> Hold file metadata + 12 direct block pointers (and single/double indirect pointers for huge files).<br />
              • <b>Directories:</b> Special files containing arrays of [name, inumber] records!
            </p>
          </div>
        </div>

        {/* Visualizer Column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-5 overflow-y-auto">
          {/* vsfs Disk Layout Strip */}
          <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-5 flex flex-col gap-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Very Simple File System (vsfs) 64-Block Disk Geometry
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs font-mono">
              <div className="bg-[#080C14] border border-[#1F293D] p-3 rounded-lg flex flex-col items-center">
                <span className="text-white font-bold">Superblock</span>
                <span className="text-[10px] text-slate-500">Block 0</span>
              </div>
              <div className="bg-[#080C14] border border-[#1F293D] p-3 rounded-lg flex flex-col items-center">
                <span className="text-indigo-400 font-bold">Inodes Map</span>
                <span className="text-[10px] text-slate-500">Block 1</span>
              </div>
              <div className="bg-[#080C14] border border-[#1F293D] p-3 rounded-lg flex flex-col items-center">
                <span className="text-emerald-400 font-bold">Data Map</span>
                <span className="text-[10px] text-slate-500">Block 2</span>
              </div>
              <div className="bg-indigo-500/10 border border-indigo-500/40 p-3 rounded-lg flex flex-col items-center">
                <span className="text-indigo-300 font-bold">Inode Table</span>
                <span className="text-[10px] text-slate-400">Blocks 3–7</span>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/40 p-3 rounded-lg flex flex-col items-center">
                <span className="text-emerald-300 font-bold">Data Blocks</span>
                <span className="text-[10px] text-slate-400">Blocks 8–63</span>
              </div>
            </div>
          </div>

          {/* Active Step Highlight Card */}
          <div className="bg-[#121826] border border-indigo-500/50 rounded-xl p-5 flex flex-col gap-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                {currentStepData.title}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Target: Inode {currentStepData.targetInode} · Block {currentStepData.targetDataBlock}
              </span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed font-mono">
              {currentStepData.desc}
            </p>
          </div>

          {/* Inode Table & Target Data Block Inspection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Inode Table */}
            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-4 flex flex-col gap-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Inode Table (Inodes 0–3)
              </h4>

              <div className="space-y-2 overflow-y-auto max-h-56">
                {inodes.map((inod) => {
                  const isActive = currentStepData.targetInode === inod.inum;

                  return (
                    <div
                      key={inod.inum}
                      className={cn(
                        "p-2.5 rounded-lg border text-xs font-mono transition-all",
                        isActive
                          ? "bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500/50"
                          : "bg-[#080C14] border-[#1F293D] text-slate-400"
                      )}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <strong className="text-slate-200">Inode #{inod.inum}</strong>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#121826] border border-[#1F293D]">
                          {inod.type}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Size: {inod.size} B · Direct Pointers: [Block {inod.directPointers.join(", ")}]
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Data Block Inspector */}
            <div className="bg-[#121826] border border-[#1F293D] rounded-xl p-4 flex flex-col gap-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Data Block Content
              </h4>

              <div className="bg-[#080C14] border border-[#1F293D] rounded-lg p-3 min-h-[140px] flex flex-col font-mono text-xs">
                {directoryData[currentStepData.targetDataBlock] ? (
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-2">
                      Directory Block #{currentStepData.targetDataBlock} Entries:
                    </span>
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-slate-500 border-b border-[#1F293D] pb-1">
                          <th>Name</th>
                          <th>Inumber</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1F293D]/40">
                        {directoryData[currentStepData.targetDataBlock].map((entry, idx) => (
                          <tr key={idx} className="py-1">
                            <td className="py-1 text-slate-200">{entry.name}</td>
                            <td className="py-1 text-indigo-400">#{entry.inum}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : fileData[currentStepData.targetDataBlock] ? (
                  <div>
                    <span className="text-[10px] text-emerald-400 block mb-1">
                      File Data Block #{currentStepData.targetDataBlock} Payload:
                    </span>
                    <p className="text-slate-200 italic leading-relaxed pt-2">
                      "{fileData[currentStepData.targetDataBlock]}"
                    </p>
                  </div>
                ) : (
                  <span className="text-slate-500 italic">No block active.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
