/**
 * Author: Faysal Alibrahim
 * GitHub: https://github.com/FAYSAL-Q8
 */


import { useState } from "react";
import { Menu, X, Cpu } from "lucide-react";
import { Sidebar, tabs } from "./components/Sidebar";

// All 12 Comprehensive OSTEP Modules
import { CPUScheduling } from "./components/Simulators/CPUScheduling";
import { ProcessAPI } from "./components/Simulators/ProcessAPI";
import { MemoryAPI } from "./components/Simulators/MemoryAPI";
import { FreeSpaceManagement } from "./components/Simulators/FreeSpaceManagement";
import { AddressTranslation } from "./components/Simulators/AddressTranslation";
import { PagingTLB } from "./components/Simulators/PagingTLB";
import { SwappingPolicies } from "./components/Simulators/SwappingPolicies";
import { ConcurrencySync } from "./components/Simulators/ConcurrencySync";
import { IODevices } from "./components/Simulators/IODevices";
import { DiskScheduling } from "./components/Simulators/DiskScheduling";
import { RAIDStorage } from "./components/Simulators/RAIDStorage";
import { FileSystemInodes } from "./components/Simulators/FileSystemInodes";

export default function App() {
  const [activeTab, setActiveTab] = useState("cpu-scheduling");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeTabMeta = tabs.find((t) => t.id === activeTab) || tabs[0];
  const ActiveIcon = activeTabMeta.icon;

  return (
    <div className="min-h-screen lg:h-screen w-full bg-[#090D16] text-slate-100 flex flex-col lg:flex-row overflow-x-hidden font-sans">
      {/* Mobile Top App Bar */}
      <header className="lg:hidden sticky top-0 z-40 bg-[#0C101C]/90 backdrop-blur-md border-b border-[#1F293D] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <ActiveIcon className="w-4 h-4 text-indigo-400" />
            <span className="font-bold text-sm text-white truncate max-w-[170px]">
              {activeTabMeta.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://github.com/FAYSAL-Q8"
            target="_blank"
            rel="noreferrer noopener"
            className="text-[11px] text-slate-400 hover:text-white"
          >
            by <strong className="text-indigo-400 font-bold">FA</strong>
          </a>
          <span className="text-[10px] font-mono font-medium text-slate-400 bg-[#121826] px-2 py-1 rounded border border-[#1F293D]">
            {activeTabMeta.chapter}
          </span>
        </div>
      </header>

      {/* Mobile Slide-Out Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-4/5 max-w-xs h-full bg-[#0C101C] border-r border-[#1F293D] shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            <div className="p-4 border-b border-[#1F293D] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  OSTEP Laboratory
                </span>
                <span className="text-[10px] text-slate-500">
                  Developed by <strong className="text-indigo-400 font-semibold">FA</strong>
                </span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 -mr-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close Navigation Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onItemClick={() => setMobileMenuOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-72 shrink-0 h-screen sticky top-0">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 lg:h-screen lg:overflow-y-auto p-4 sm:p-6 lg:p-8 xl:p-10 flex flex-col">
        {/* Top Global Sub-Bar */}
        <div className="mx-auto w-full max-w-[1400px] flex items-center justify-between pb-4 mb-4 border-b border-[#1F293D]/60 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-medium">OSTEP Systems Laboratory</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-500 font-mono">Three Easy Pieces</span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-slate-400">
              Developed by <strong className="text-indigo-400 font-bold">FA</strong>
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <a
              href="https://github.com/FAYSAL-Q8"
              target="_blank"
              rel="noreferrer noopener"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-mono transition-colors font-medium hover:underline"
            >
              github.com/FAYSAL-Q8
            </a>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1400px] flex-1 flex flex-col">
          {activeTab === "cpu-scheduling" && <CPUScheduling />}
          {activeTab === "process-api" && <ProcessAPI />}
          {activeTab === "memory-api" && <MemoryAPI />}
          {activeTab === "free-space" && <FreeSpaceManagement />}
          {activeTab === "segmentation" && <AddressTranslation />}
          {activeTab === "paging-tlb" && <PagingTLB />}
          {activeTab === "swapping" && <SwappingPolicies />}
          {activeTab === "concurrency" && <ConcurrencySync />}
          {activeTab === "io-devices" && <IODevices />}
          {activeTab === "disk-scheduling" && <DiskScheduling />}
          {activeTab === "raid" && <RAIDStorage />}
          {activeTab === "file-system" && <FileSystemInodes />}
        </div>

        {/* Global Footer */}
        <footer className="mx-auto w-full max-w-[1400px] mt-8 pt-6 pb-2 border-t border-[#1F293D]/60 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 shrink-0">
          <div>OSTEP Interactive Simulator · Operating Systems Laboratory</div>
          <div className="flex items-center gap-2">
            <span>
              Developed by <strong className="text-slate-300 font-semibold">FA</strong> (Faysal Alibrahim)
            </span>
            <span aria-hidden="true">·</span>
            <a
              href="https://github.com/FAYSAL-Q8"
              target="_blank"
              rel="noreferrer noopener"
              className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              https://github.com/FAYSAL-Q8
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
