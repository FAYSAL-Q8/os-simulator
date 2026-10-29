import { 
  Cpu, 
  GitFork,
  Users, 
  MemoryStick, 
  Layers, 
  Terminal,
  ArrowRightLeft, 
  HardDrive,
  Disc,
  FolderTree,
  Sliders
} from "lucide-react";
import { cn } from "../lib/utils";

export interface NavItem {
  id: string;
  label: string;
  chapter: string;
  icon: typeof Cpu;
  category: "CPU Virtualization" | "Memory Virtualization" | "Concurrency" | "Persistence & Storage";
}

export const tabs: NavItem[] = [
  // CPU Virtualization
  { id: "cpu-scheduling", label: "CPU Scheduling", chapter: "Ch 7–9", icon: Cpu, category: "CPU Virtualization" },
  { id: "process-api", label: "Process API & fork()", chapter: "Ch 4–6", icon: GitFork, category: "CPU Virtualization" },

  // Memory Virtualization
  { id: "memory-api", label: "Memory API & Heap", chapter: "Ch 14", icon: MemoryStick, category: "Memory Virtualization" },
  { id: "free-space", label: "Free-Space Management", chapter: "Ch 17", icon: Sliders, category: "Memory Virtualization" },
  { id: "segmentation", label: "Address Translation", chapter: "Ch 15–16", icon: Layers, category: "Memory Virtualization" },
  { id: "paging-tlb", label: "Paging & TLB Cache", chapter: "Ch 18–20", icon: Terminal, category: "Memory Virtualization" },
  { id: "swapping", label: "Swapping Policies", chapter: "Ch 21–22", icon: ArrowRightLeft, category: "Memory Virtualization" },

  // Concurrency
  { id: "concurrency", label: "Concurrency & Locks", chapter: "Ch 28–32", icon: Users, category: "Concurrency" },

  // Persistence & Storage
  { id: "io-devices", label: "I/O Devices & DMA", chapter: "Ch 36", icon: HardDrive, category: "Persistence & Storage" },
  { id: "disk-scheduling", label: "Disk Head Scheduling", chapter: "Ch 37", icon: Disc, category: "Persistence & Storage" },
  { id: "raid", label: "RAID & Parity Recovery", chapter: "Ch 38", icon: HardDrive, category: "Persistence & Storage" },
  { id: "file-system", label: "File System Inodes", chapter: "Ch 40", icon: FolderTree, category: "Persistence & Storage" },
];

interface SidebarProps {
  activeTab: string;
  setActiveTab: (id: string) => void;
  onItemClick?: () => void;
}

export function Sidebar({ activeTab, setActiveTab, onItemClick }: SidebarProps) {
  const categories = [
    "CPU Virtualization",
    "Memory Virtualization",
    "Concurrency",
    "Persistence & Storage",
  ] as const;

  return (
    <div className="w-full h-full bg-[#0C101C] border-r border-[#1F293D] flex flex-col overflow-y-auto">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#1F293D] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">OSTEP Laboratory</h1>
            <p className="text-[11px] text-slate-400">
              Developed by <a href="https://github.com/FAYSAL-Q8" target="_blank" rel="noreferrer noopener" className="text-indigo-400 hover:text-indigo-300 font-semibold">FA</a>
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Grouped by Pillar */}
      <div className="flex-1 p-4 space-y-5">
        {categories.map((cat) => {
          const items = tabs.filter((t) => t.category === cat);
          if (items.length === 0) return null;

          return (
            <div key={cat} className="space-y-1">
              <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                {cat}
              </span>
              <div className="space-y-1">
                {items.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        if (onItemClick) onItemClick();
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all text-left min-h-[42px]",
                        isActive
                          ? "bg-indigo-600 text-white font-semibold shadow-sm"
                          : "text-slate-400 hover:text-slate-200 hover:bg-[#121826]"
                      )}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-white" : "text-slate-400")} />
                        <span className="truncate">{tab.label}</span>
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-mono shrink-0 ml-2",
                          isActive ? "text-indigo-200" : "text-slate-500"
                        )}
                      >
                        {tab.chapter}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-[#1F293D] flex flex-col gap-2 shrink-0 bg-[#080C14]">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>12 Core Modules</span>
          <span>OSTEP Complete</span>
        </div>
        <div className="pt-2 border-t border-[#1F293D]/60 flex items-center justify-between">
          <span className="text-xs text-slate-300">
            Developed by <strong className="text-indigo-400 font-bold">FA</strong>
          </span>
          <a
            href="https://github.com/FAYSAL-Q8"
            target="_blank"
            rel="noreferrer noopener"
            className="text-xs text-slate-400 hover:text-white transition-colors font-mono"
          >
            @FAYSAL-Q8
          </a>
        </div>
      </div>
    </div>
  );
}
