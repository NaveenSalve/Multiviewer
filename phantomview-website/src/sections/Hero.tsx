import { useEffect, useRef } from 'react';
import { Download, ArrowRight, Play, Eye, Shield, Cpu, Layout } from 'lucide-react';

const FEATURES = [
  { icon: Layout, title: 'Multi-Stream Matrix', desc: 'Run 100+ sessions simultaneously in a cinematic grid layout.' },
  { icon: Shield, title: 'Privacy Routing', desc: 'Per-tab SOCKS5 proxy, cookie isolation, and tracker deflection.' },
  { icon: Cpu, title: 'Neural Resource AI', desc: 'AI-powered RAM optimization for smooth multi-tasking performance.' },
];

export function Hero() {
  return (
    <section id="hero" className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-b from-primary-50/50 to-white dark:from-neutral-950 dark:to-neutral-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.08),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.12),transparent_70%)]" />

      <div className="section-container relative z-10 pt-24 pb-16 sm:pt-32 sm:pb-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <span className="badge">
              <Eye className="w-3.5 h-3.5" />
              v2.4.0 — Now Available
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-neutral-900 dark:text-white leading-[1.1]">
            Mission Control for
            <br />
            <span className="gradient-text">the Modern Internet</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            Watch, monitor, and research across 100+ multi-engine sessions from one cinematic
            cockpit. AI-powered resource management with enterprise-grade privacy controls.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => document.getElementById('operating-matrix')?.scrollIntoView({ behavior: 'smooth' })}
              className="btn-primary text-base px-8 py-4"
            >
              Explore Live OS
              <ArrowRight className="w-5 h-5" />
            </button>
            <button className="btn-secondary text-base px-8 py-4">
              <Download className="w-5 h-5" />
              Download .exe Setup
            </button>
          </div>

          <div className="mt-12 flex items-center justify-center gap-6 sm:gap-10">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 border-2 border-white dark:border-neutral-950" />
              ))}
            </div>
            <div className="h-8 w-px bg-neutral-300 dark:bg-neutral-700" />
            <div className="flex items-center gap-1.5">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400 ml-1">4.9/5</span>
            </div>
            <div className="h-8 w-px bg-neutral-300 dark:bg-neutral-700" />
            <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">10K+ downloads</span>
          </div>
        </div>

        <div className="mt-16 sm:mt-20">
          <div className="card p-4 sm:p-6 max-w-5xl mx-auto">
            <div className="aspect-video rounded-lg bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-primary-600 flex items-center justify-center shadow-lg mb-4">
                  <Play className="w-7 h-7 text-white ml-0.5" />
                </div>
                <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Watch Overview</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {FEATURES.map((f, i) => (
            <div key={i} className="card-hover p-6">
              <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="font-semibold text-neutral-900 dark:text-white mb-1.5">{f.title}</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
