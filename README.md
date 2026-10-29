# OSTEP Interactive Simulator

[![Live Demo](https://img.shields.io/badge/Live%20Demo-os--simu.vercel.app-6366f1?style=for-the-badge&logo=vercel)](https://os-simu.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge)](LICENSE)
[![GitHub](https://img.shields.io/badge/Author-Faysal%20Alibrahim-181717?style=for-the-badge&logo=github)](https://github.com/FAYSAL-Q8)

> An interactive, cycle-accurate operating systems laboratory simulating the core mechanisms and policies of virtualization, concurrency, and persistence. Built for computer science students and systems engineers, this platform transforms abstract algorithmic concepts from *Operating Systems: Three Easy Pieces (OSTEP)* into tactile, visual, and measurable experiments.

🌐 **Live Production Deployment**: [https://os-simu.vercel.app/](https://os-simu.vercel.app/)

---

## Core Features

- **CPU Virtualization**:
  - **CPU Scheduling**: Cycle-by-cycle Gantt chart simulation of FIFO, Shortest Job First (SJF), Shortest Time-to-Completion First (STCF/Preemptive), Round Robin (RR with configurable time quantum $Q$), and Multi-Level Feedback Queue (MLFQ with priority boost & allotment).
  - **Process API & Lifecycle**: Interactive Process Tree managing `fork()`, `exec()`, `wait()`, `exit()`, Process Control Block (PCB) state transitions, and zombie process reaping.
- **Memory Virtualization**:
  - **Memory API & Heap Exceptions**: Dynamic allocation tracking stack pointers, heap blocks, memory leak detection, dangling pointers, use-after-free, and segmentation faults.
  - **Free-Space Management**: First Fit, Best Fit, Worst Fit, and Next Fit search strategies with block splitting, adjacent free block coalescing, and live external fragmentation gauges.
  - **Address Translation & Segmentation**: Base and bounds registers, negative stack growth, 14-bit virtual-to-physical address decoding, and hardware protection boundary checks.
  - **Paging & Hardware TLB**: Hierarchical two-level page table walking (CR3, PDI, PTI) paired with a hardware TLB cache supporting ASID and LRU/FIFO replacement policies.
  - **Swapping Policies**: Replacement benchmark comparing Optimal (MIN), FIFO (Belady's Anomaly), LRU, Clock (Second Chance with use bit), and Random with live AMAT metrics.
- **Concurrency & Synchronization**:
  - **Bounded Buffer Problem**: Real-time race condition demonstrations contrasting unsynchronized memory access against Mutex Locks and Counting Semaphores (`empty`, `full`, `mutex`).
  - **Deadlock Detection & Prevention**: Resource Allocation Graph (RAG) verifying Coffman's 4 Conditions (Mutual Exclusion, Hold and Wait, No Preemption, Circular Wait) and demonstrating strict lock hierarchy prevention.
- **Persistence & Storage**:
  - **I/O Devices & DMA**: Cycle-accurate timeline and CPU utilization comparison between Polling (PIO), Interrupt-Driven I/O, and Direct Memory Access (DMA).
  - **Disk Head Scheduling**: 0–199 cylinder seek path simulation for FCFS, Shortest Seek Time First (SSTF), SCAN (Elevator), C-SCAN, LOOK, and C-LOOK.
  - **RAID Storage & XOR Parity Recovery**: Interactive 4-disk array modeling RAID 0, RAID 1, RAID 4, and RAID 5 with live drive failure toggling and on-the-fly bitwise XOR parity reconstruction.
  - **File System Inodes**: Very Simple File System (`vsfs`) on-disk layout (Superblock, Inode Bitmap, Data Bitmap, Inodes) with step-by-step path traversal for hierarchical directories.

---

## Tech Stack & Architecture

- **Live Application**: [https://os-simu.vercel.app/](https://os-simu.vercel.app/)
- **Frontend Framework**: React 19 + TypeScript (Strict Mode)
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS v4 with custom Obsidian & Indigo systems theme
- **Typography**: Plus Jakarta Sans (UI) & JetBrains Mono (Registers/Addresses)
- **Data Visualization**: Recharts & custom SVG hardware timelines
- **Icons**: Lucide React
- **Architecture**: Modular, zero-dependency client-side simulation engine (no backend or external API dependencies required for execution)

---

## Prerequisites & Setup

Ensure you have **Node.js 18.0.0 or higher** and **npm** installed on your system.

### 1. Clone the Repository
```bash
git clone https://github.com/FAYSAL-Q8/ostep-simulator.git
cd ostep-simulator
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
```bash
npm run dev
```
The application will be accessible at `http://localhost:3000`.

### 4. Build for Production
```bash
npm run build
```
The optimized production bundle will be generated in the `dist/` directory, ready for immediate deployment on Vercel, Netlify, or GitHub Pages.

---

## Usage & Execution Guide

1. **Select a Module**: Use the navigation sidebar (or mobile drawer) to navigate between CPU Virtualization, Memory Virtualization, Concurrency, and Persistence.
2. **Configure Parameters**: Adjust workload inputs, burst times, time quantum, memory block sizes, or replacement policies in the left control deck.
3. **Execute Simulation**: Use **Simulate (Play)** for real-time automatic playback or **Step** to analyze cycle-by-cycle hardware transitions.
4. **Inspect Metrics**: Observe live Gantt timelines, CPU utilization charts, address bit decoders, or bitwise XOR calculations in the right visualizer canvas.

---

## Author

**Faysal Alibrahim**  
GitHub: [https://github.com/FAYSAL-Q8](https://github.com/FAYSAL-Q8)

---

## License

This project is licensed under the [MIT License](LICENSE).
