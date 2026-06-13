import React, { useState } from 'react';
import { Layers, Maximize2, Eye, MousePointer, ShieldAlert, Sparkles, Play, Volume2, RefreshCw } from 'lucide-react';
import { useAppStore, OverlayModeType } from '../../store/useAppStore';

export function OverlayDemo() {
  const { overlayMode, setOverlayMode } = useAppStore();
  const [windowPos, setWindowPos] = useState({ x: 40, y: 30 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const modes: { id: OverlayModeType; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
    {
      id: 'floating',
      label: 'Floating Window',
      desc: 'Standard unpinned mini-window. Free floating with instant snap.',
      icon: <Maximize2 className="w-4 h-4 text-[#7B5CFA]" />,
      color: 'border-[#7B5CFA]/40 text-[#7B5CFA]',
    },
    {
      id: 'alwaysOnTop',
      label: 'Always-on-Top',
      desc: 'Never gets hidden. Stays persistent above your IDE or Trading Terminal.',
      icon: <Layers className="w-4 h-4 text-[#00D4FF]" />,
      color: 'border-[#00D4FF]/40 text-[#00D4FF]',
    },
    {
      id: 'transparent',
      label: 'Transparent HUD',
      desc: 'Border-free holographic overlay. Blends seamlessly into your game or workspace.',
      icon: <Eye className="w-4 h-4 text-[#F59E0B]" />,
      color: 'border-[#F59E0B]/40 text-[#F59E0B]',
    },
    {
      id: 'clickThrough',
      label: 'Click-Through Ops',
      desc: 'Complete ghost mode. Clicks pass right through to the desktop underneath.',
      icon: <MousePointer className="w-4 h-4 text-[#10B981]" />,
      color: 'border-[#10B981]/40 text-[#10B981]',
    },
  ];

  const handleMouseDown = (e: React.MouseEvent) => {
    if (overlayMode === 'clickThrough') return; // Cannot drag in click-through mode
    setIsDragging(true);
    setDragStart({
      x: e.clientX - windowPos.x,
      y: e.clientY - windowPos.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const container = e.currentTarget.getBoundingClientRect();
    const newX = Math.max(10, Math.min(container.width - 280, e.clientX - dragStart.x));
    const newY = Math.max(10, Math.min(container.height - 180, e.clientY - dragStart.y));
    setWindowPos({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      
      {/* Left Feature Pills / Selector */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EC4899]/10 border border-[#EC4899]/30 text-[#EC4899] text-xs font-mono self-start mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>ENGINE 03 // OVERLAY PRO</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-white tracking-tight">
          Unstoppable <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#EC4899] via-[#7B5CFA] to-[#00D4FF]">HUD Experience</span>
        </h2>
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          PhantomView hooks deep into the Windows Desktop Window Manager (DWM) to provide flawless hardware-accelerated overlays that never lag or stutter.
        </p>

        {/* Mode Selector Pills */}
        <div className="flex flex-col gap-3">
          {modes.map((m) => (
            <div
              key={m.id}
              onClick={() => setOverlayMode(m.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 flex items-start gap-4 ${
                overlayMode === m.id
                  ? 'bg-[#161920] border-[#7B5CFA] shadow-[0_0_20px_rgba(123,92,250,0.25)]'
                  : 'bg-[#0E1014]/60 border-white/10 hover:border-white/20 hover:bg-[#0E1014]'
              }`}
            >
              <div className={`p-2.5 rounded-lg bg-[#07080A] border ${m.color} mt-0.5`}>
                {m.icon}
              </div>
              <div className="flex flex-col text-left">
                <span className="font-heading font-bold text-sm text-white flex items-center justify-between">
                  {m.label}
                  {overlayMode === m.id && (
                    <span className="text-[10px] font-mono bg-[#7B5CFA] text-white px-2 py-0.5 rounded uppercase">Active Mode</span>
                  )}
                </span>
                <span className="text-xs text-gray-400 mt-1 leading-normal">{m.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Desktop Simulation Screen */}
      <div className="lg:col-span-7">
        <div className="relative rounded-2xl p-1 bg-gradient-to-b from-white/15 to-white/5 shadow-2xl">
          {/* Simulated Desktop Window */}
          <div
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="relative w-full h-[450px] bg-[#07080A] rounded-[15px] overflow-hidden flex flex-col select-none border border-white/5"
          >
            
            {/* Desktop Mock Wallpapers / App BG */}
            <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
            
            {/* Simulated Background Trading/Code Workspace */}
            <div className="absolute inset-6 bg-[#0E1014] rounded-xl border border-white/10 p-6 flex flex-col justify-between pointer-events-none">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500/80" />
                  <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <span className="w-3 h-3 rounded-full bg-green-500/80" />
                  <span className="ml-3 text-xs font-mono text-gray-400 font-bold">ETH/USDT — Live Perpetual Swap</span>
                </div>
                <div className="text-xs font-mono text-[#00D4FF]">
                  +14.82% ($3,842.10)
                </div>
              </div>

              {/* Mock Candlestick Charts */}
              <div className="flex items-end gap-2 h-48 opacity-30">
                <div className="flex-1 h-3/4 bg-green-500 rounded" />
                <div className="flex-1 h-1/2 bg-red-500 rounded" />
                <div className="flex-1 h-full bg-green-500 rounded" />
                <div className="flex-1 h-4/5 bg-green-500 rounded" />
                <div className="flex-1 h-2/3 bg-red-500 rounded" />
                <div className="flex-1 h-5/6 bg-green-500 rounded" />
                <div className="flex-1 h-full bg-green-500 rounded shadow-[0_0_15px_#10B981]" />
              </div>

              <div className="font-mono text-[11px] text-gray-500 bg-[#07080A] p-3 rounded-lg flex items-center justify-between">
                <span>SYSTEM STATUS: ACTIVE // 0 PACKET DROP</span>
                <span className="text-[#10B981]">● REALTIME STREAM</span>
              </div>
            </div>

            {/* Simulated Interactive Floating Mini-Window */}
            <div
              onMouseDown={handleMouseDown}
              style={{ left: `${windowPos.x}px`, top: `${windowPos.y}px` }}
              className={`absolute w-72 sm:w-80 transition-all ${
                overlayMode === 'transparent'
                  ? 'bg-transparent border-transparent backdrop-blur-none shadow-none'
                  : overlayMode === 'clickThrough'
                  ? 'bg-[#0E1014]/40 border-white/5 backdrop-blur-sm pointer-events-none opacity-60'
                  : 'bg-[#161920]/90 border border-[#7B5CFA]/60 backdrop-blur-2xl shadow-[0_15px_40px_rgba(0,0,0,0.9)]'
              } rounded-xl overflow-hidden z-20 ${
                overlayMode === 'clickThrough' ? '' : 'cursor-move'
              } ${isDragging ? 'scale-105 shadow-[0_20px_50px_rgba(123,92,250,0.4)]' : ''}`}
            >
              {/* Floating Window Top Header Bar */}
              <div className={`px-3 py-2 ${overlayMode === 'transparent' ? 'hidden' : 'bg-black/60'} border-b border-white/10 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-[#00D4FF]" />
                  <span className="text-[11px] font-mono text-white font-bold">Phantom Stream #1</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono bg-[#00D4FF]/20 text-[#00D4FF] px-1 py-0.5 rounded uppercase">
                    {overlayMode}
                  </span>
                </div>
              </div>

              {/* Floating Window Video Screen */}
              <div className="relative aspect-video bg-gradient-to-br from-indigo-950/80 to-purple-950/80 p-4 flex flex-col justify-between border border-white/5">
                <div className="flex items-center justify-between text-xs text-white">
                  <span className="font-bold flex items-center gap-1.5 text-[11px]">
                    <Play className="w-3 h-3 text-[#10B981] fill-[#10B981]" /> Creator Stream
                  </span>
                  <Volume2 className="w-3.5 h-3.5 text-gray-400" />
                </div>

                <div className="self-center my-auto flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mb-1 animate-pulse">
                    <Play className="w-4 h-4 text-white fill-white translate-x-0.5" />
                  </div>
                  <span className="text-[10px] font-mono text-gray-300">LIVE // 1080p60</span>
                </div>

                <div className="w-full bg-white/20 h-1 rounded-full overflow-hidden">
                  <div className="bg-[#7B5CFA] h-full w-2/3 animate-pulse" />
                </div>
              </div>
            </div>

            {/* User Instructional Banner at Desktop Bottom */}
            <div className="absolute bottom-3 left-6 right-6 bg-[#0E1014]/90 border border-white/10 px-4 py-3 rounded-xl backdrop-blur-md flex items-center justify-between z-30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#7B5CFA]/20 text-[#7B5CFA]">
                  {overlayMode === 'clickThrough' ? <ShieldAlert className="w-4 h-4" /> : <MousePointer className="w-4 h-4" />}
                </div>
                <div className="text-left">
                  <span className="text-xs font-heading font-bold text-white block">
                    {overlayMode === 'clickThrough' ? "Ghost Ops Mode Engaged" : "Interactive Desktop Mockup"}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {overlayMode === 'clickThrough'
                      ? "Clicks now pass to the desktop. Switch modes on the left to restore dragging."
                      : "Click and drag the floating PhantomView HUD window across the virtual screen."}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setWindowPos({ x: 40, y: 30 })}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
                title="Reset Position"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}
