import { lazy, Suspense } from 'react';
import { NavBar } from '../components/layout/NavBar';
import { Hero } from './Hero';
import { Footer } from '../components/layout/Footer';

const VideoMatrix = lazy(() => import('./VideoMatrix').then(m => ({ default: m.VideoMatrix })));
const WorkspacePresets = lazy(() => import('./WorkspacePresets').then(m => ({ default: m.WorkspacePresets })));
const OverlayEngine = lazy(() => import('./OverlayEngine').then(m => ({ default: m.OverlayEngine })));
const PrivacyCenter = lazy(() => import('./PrivacyCenter').then(m => ({ default: m.PrivacyCenter })));
const ResourceAI = lazy(() => import('./ResourceAI').then(m => ({ default: m.ResourceAI })));
const MissionControlDashboard = lazy(() => import('./MissionControlDashboard').then(m => ({ default: m.MissionControlDashboard })));
const SocialProof = lazy(() => import('./SocialProof').then(m => ({ default: m.SocialProof })));
const DownloadCTA = lazy(() => import('./DownloadCTA').then(m => ({ default: m.DownloadCTA })));

interface LandingPageProps {
  onEnterMissionControl: () => void;
}

function SectionFallback() {
  return (
    <div className="section-padding bg-white dark:bg-neutral-950">
      <div className="section-container">
        <div className="max-w-3xl mx-auto text-center">
          <div className="h-8 w-48 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse mx-auto mb-4" />
          <div className="h-4 w-96 bg-neutral-100 dark:bg-neutral-800/50 rounded animate-pulse mx-auto" />
        </div>
      </div>
    </div>
  );
}

export function LandingPage({ onEnterMissionControl }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <NavBar onViewChange={() => onEnterMissionControl()} />
      <Hero />
      <Suspense fallback={<SectionFallback />}><VideoMatrix /></Suspense>
      <Suspense fallback={<SectionFallback />}><WorkspacePresets /></Suspense>
      <Suspense fallback={<SectionFallback />}><OverlayEngine /></Suspense>
      <Suspense fallback={<SectionFallback />}><PrivacyCenter /></Suspense>
      <Suspense fallback={<SectionFallback />}><ResourceAI /></Suspense>
      <Suspense fallback={<SectionFallback />}><MissionControlDashboard /></Suspense>
      <Suspense fallback={<SectionFallback />}><SocialProof /></Suspense>
      <Suspense fallback={<SectionFallback />}><DownloadCTA /></Suspense>
      <Footer />
    </div>
  );
}
