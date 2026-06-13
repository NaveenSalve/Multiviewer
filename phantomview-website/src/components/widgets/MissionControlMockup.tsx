import React, { useRef, useState } from 'react';
import { Shield, LayoutGrid, Terminal, Command, Zap, Search, Bell, Settings, Video, Activity, RefreshCw } from 'lucide-react';

export function MissionControlMockup() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState(0);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Calculate rotation between -6 and 6 degrees
    const rX = -((e.clientY - rect.top) / height - 0.5) * 12;
    const rY = ((e.clientX - rect.left) / width - 0.5) * 12;
    setRotate({ x: rX, y: rY });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
  };

  const mockTabs = [
    { title: 'MATRIX DECK 01 // CORE', count: '9 STREAMS', status: 'ACTIVE', color: 'from-[#7B5CFA] to-[#00D4FF]' },
    { title: 'TRADING HUD // BTC/SOL', count: '4 TERMINALS', status: 'PERSISTENT', color: 'from-[#F59E0B] to-[#EC4899]' },
    { title: 'SECURITY PROXY // SOCKS5', count: 'ISOLATED', status: 'ENCRYPTED', color: 'from-[#10B981] to-[#00D4FF]' },
    { title: 'RESEARCH VAULT // AI', count: '12 SESSIONS', status: 'CACHED', color: 'from-[#6366F1] to-[#8B5CF6]' },
  ];

  const thumbnails = [
    { name: 'YouTube Live', mode: '1080p AI', fps: '60 FPS', ram: '142 MB', tag: 'VID_01' },
    { name: 'TradingView Perpetual', mode: 'Vector', fps: '120 FPS', ram: '210 MB', tag: 'TRD_01' },
    { name: 'Discord Dark Channel', mode: 'SOCKS5', fps: '60 FPS', ram: '98 MB', tag: 'COM_01' },
    { name: 'LinkedIn Research', mode: 'Isolated', fps: '30 FPS', ram: '115 MB', tag: 'RSH_01' },
    { name: 'Bloomberg Terminal 3', mode: 'HLS Live', fps: '60 FPS', ram: '180 MB', tag: 'VID_02' },
    { name: 'Neural Resource Controller', mode: 'Kernel', fps: '240 FPS', ram: '32 MB', tag: 'SYS_AI' },
  ];

  return (
    <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 overflow-hidden">
      
      {/* Subtle Background Highlights */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-gradient-to-tr from-[#7B5CFA]/15 via-[#00D4FF]/10 to-[#F59E0B]/10 blur-[120px] pointer-events-none -z-10" />

      {/* Header Copy */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7B5CFA]/10 border border-[#7B5CFA]/30 text-[#7B5CFA] text-xs font-mono mb-4">
          <Command className="w-3.5 h-3.5" />
          <span>ENGINE 06 // MISSION CONTROL HUD</span>
        </div>
        <h2 className="text-4xl sm:text-5xl font-heading font-black text-white tracking-tight mb-6">
          One Cockpit. <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7B5CFA] via-[#00D4FF] to-[#10B981]">Complete Command.</span>
        </h2>
        <p className="text-gray-400 text-base leading-relaxed">
          Instantly survey 100+ active background sessions, assign SOCKS5 proxies per tab, or switch workspace modes with a single hotkey.
        </p>
      </div>

      {/* High-Fidelity Interactive Tilt Dashboard Screen */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="transform-gpu perspective-1200 transition-transform duration-200 ease-out flex justify-center"
      >
        <div
          style={{
            transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
          }}
          className="relative w-full rounded-2xl bg-[#0E1014] border border-white/10 shadow-[0_25px_70px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col group transition-all duration-300 hover:border-[#7B5CFA]/50 hover:shadow-[0_0_50px_rgba(123,92,250,0.3)]"
        >
          
          {/* Top Window Bar */}
          <div className="bg-[#07080A] px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#EF4444] cursor-pointer hover:opacity-80" />
                <span className="w-3 h-3 rounded-full bg-[#F59E0B] cursor-pointer hover:opacity-80" />
                <span className="w-3 h-3 rounded-full bg-[#10B981] cursor-pointer hover:opacity-80" />
              </div>
              <div className="h-4 w-[1px] bg-white/10 mx-2" />
              <div className="flex items-center gap-2 bg-[#161920] px-3 py-1 rounded-lg border border-white/5 text-xs font-mono text-gray-300">
                <Shield className="w-3.5 h-3.5 text-[#00D4FF]" />
                <span>PHANTOM_MISSION_CONTROL_V2.4</span>
              </div>
            </div>

            {/* Quick Stats at Top Right */}
            <div className="flex items-center gap-6">
              <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-gray-400">
                <Zap className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>CPU: 2.1%</span>
                <span className="text-white/20">/</span>
                <span>RAM SAVED: 4.8 GB</span>
              </div>
              <div className="flex items-center gap-3">
                <button className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300">
                  <Search className="w-4 h-4" />
                </button>
                <button className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300">
                  <Bell className="w-4 h-4" />
                </button>
                <button className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Sub Header Navigation Tabs */}
          <div className="bg-[#161920]/60 px-6 py-3 border-b border-white/5 flex items-center gap-4 overflow-x-auto custom-scrollbar">
            {mockTabs.map((tab, idx) => (
              <div
                key={idx}
                onClick={() => setActiveTab(idx)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer whitespace-nowrap transition-all ${
                  activeTab === idx
                    ? 'bg-[#0E1014] border-[#7B5CFA] shadow-[0_0_20px_rgba(123,92,250,0.3)] text-white'
                    : 'bg-transparent border-white/5 text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${tab.color}`} />
                <div className="flex flex-col text-left">
                  <span className="font-heading font-bold text-xs">{tab.title}</span>
                  <span className="text-[10px] font-mono text-[#00D4FF]">{tab.count} • {tab.status}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Main Internal Workspace Grid */}
          <div className="p-6 bg-[#0E1014] flex-1">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <LayoutGrid className="w-5 h-5 text-[#7B5CFA]" />
                <h3 className="font-heading font-bold text-lg text-white">
                  Active Monitoring Matrix // <span className="text-gray-400 text-sm font-mono font-normal">WORKSPACE_SESSION_0{activeTab+1}</span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 rounded-lg bg-[#7B5CFA]/20 border border-[#7B5CFA]/40 text-[#7B5CFA] text-xs font-mono font-bold hover:bg-[#7B5CFA] hover:text-white transition-colors flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>SYNC ALL STREAMS</span>
                </button>
              </div>
            </div>

            {/* Thumbnail Screens Array */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {thumbnails.map((t, index) => (
                <div
                  key={index}
                  className="relative rounded-xl bg-[#161920]/80 border border-white/10 p-4 flex flex-col justify-between overflow-hidden group/card hover:border-[#00D4FF]/50 transition-all"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#7B5CFA]/10 to-transparent pointer-events-none rounded-tr-xl" />
                  
                  {/* Top line */}
                  <div className="flex items-center justify-between mb-3 relative z-10">
                    <span className="px-2 py-0.5 rounded bg-black/50 border border-white/10 text-[10px] font-mono font-bold text-[#00D4FF]">
                      {t.tag}
                    </span>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-gray-400">
                      <Activity className="w-3.5 h-3.5 text-[#10B981]" />
                      <span>{t.fps}</span>
                      <span>•</span>
                      <span className="text-[#7B5CFA] font-bold">{t.ram}</span>
                    </div>
                  </div>

                  {/* Simulated Screen View */}
                  <div className="aspect-video rounded-lg bg-[#07080A] border border-white/5 flex items-center justify-center p-3 mb-3 relative z-10 overflow-hidden">
                    <div className="absolute inset-0 bg-grid-pattern opacity-30" />
                    <div className="flex flex-col items-center gap-2 relative z-10">
                      <Video className="w-6 h-6 text-gray-500 group-hover/card:text-[#00D4FF] group-hover/card:scale-110 transition-all" />
                      <span className="text-xs font-heading font-semibold text-gray-300 group-hover/card:text-white transition-colors">
                        {t.name}
                      </span>
                      <span className="text-[10px] font-mono text-gray-500">
                        ROUTING: {t.mode.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Tool Bar */}
                  <div className="flex items-center justify-between text-xs relative z-10 pt-2 border-t border-white/5">
                    <span className="text-gray-400 font-mono text-[10px]">STATUS: LIVE OK</span>
                    <button className="text-[11px] font-heading font-bold text-[#7B5CFA] hover:text-[#00D4FF] flex items-center gap-1">
                      <span>Expand Panel</span> &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Footer Information Line */}
          <div className="bg-[#07080A] px-6 py-3 border-t border-white/10 flex items-center justify-between text-xs font-mono text-gray-400">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#10B981]" />
              <span>TERMINAL READY // PRESS `CTRL + SPACE` TO EXECUTE COMMAND</span>
            </div>
            <div>
              <span className="text-[#00D4FF]">100% HARDWARE ENHANCED</span>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
