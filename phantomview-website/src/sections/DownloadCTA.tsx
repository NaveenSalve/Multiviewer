import { Download, ArrowRight, CheckCircle, Monitor } from 'lucide-react';
import { useState } from 'react';

const REQUIREMENTS = [
  'Windows 10 / 11 (64-bit)',
  '8 GB RAM (16 GB recommended)',
  '500 MB storage',
  '100% VirusTotal Clean',
];

export function DownloadCTA() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    setDownloading(true);
    setTimeout(() => setDownloading(false), 3000);
  };

  return (
    <section id="download" className="section-padding relative overflow-hidden bg-gradient-to-b from-primary-50 to-white dark:from-neutral-950 dark:to-neutral-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(37,99,235,0.06),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_bottom,rgba(37,99,235,0.1),transparent_70%)]" />

      <div className="section-container relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <span className="badge mb-4">
<Monitor className="w-3.5 h-3.5" />
            Windows Desktop App
          </span>

          <h2 className="section-title">Your Cockpit Awaits</h2>
          <p className="section-subtitle mx-auto">
            Download PhantomView OS and transform your Windows desktop into a
            professional-grade multi-stream command center.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="btn-primary text-base px-8 py-4 min-w-[200px]"
            >
              {downloading ? (
                <>Preparing Setup&hellip;</>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Download .exe Setup
                </>
              )}
            </button>
            <button className="btn-secondary text-base px-8 py-4">
              View Changelog
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-8 card p-6 max-w-lg mx-auto">
            <h4 className="font-semibold text-sm text-neutral-900 dark:text-white mb-3">System Requirements</h4>
            <div className="flex flex-col gap-2">
              {REQUIREMENTS.map((req, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm text-neutral-600 dark:text-neutral-400">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  {req}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
