import { Star, MessageCircle } from 'lucide-react';

const REVIEWS = [
  {
    name: 'Alex Chen',
    role: 'Professional Streamer',
    content: 'PhantomView completely changed how I manage my stream. I can monitor chat, check donations, preview my feed, and keep an eye on analytics all at once. The resource AI keeps everything smooth even with OBS running.',
    rating: 5,
  },
  {
    name: 'Sarah Mitchell',
    role: 'Crypto Fund Manager',
    content: 'Running 16 trading view charts, news feeds, and order books simultaneously used to require three monitors. Now I do it all in one window with per-tab proxy routing. Essential tool for my workflow.',
    rating: 5,
  },
  {
    name: 'Dr. James Park',
    role: 'Cybersecurity Researcher',
    content: 'The privacy engine is outstanding. Being able to route different research sessions through different global endpoints while keeping cookies completely isolated is a game changer for OSINT work.',
    rating: 5,
  },
];

export function SocialProof() {
  return (
    <section id="social-proof" className="section-padding bg-white dark:bg-neutral-950">
      <div className="section-container">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="section-label">
            <MessageCircle className="w-3.5 h-3.5" />
            Testimonials
          </span>
          <h2 className="section-title">Trusted by Power Users</h2>
          <p className="section-subtitle mx-auto">
            From streamers to security researchers — see why professionals
            choose PhantomView OS for their daily workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {REVIEWS.map((review, i) => (
            <div key={i} className="card-hover p-6 flex flex-col">
              <div className="flex gap-1 mb-4">
                {[...Array(review.rating)].map((_, j) => (
                  <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed flex-1">
                &ldquo;{review.content}&rdquo;
              </p>
              <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <p className="font-semibold text-sm text-neutral-900 dark:text-white">{review.name}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{review.role}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 card p-6 max-w-4xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-4 text-center">Integrated Platforms</p>
          <div className="flex flex-wrap justify-center gap-3">
            {['YouTube', 'Twitch', 'TradingView', 'Bloomberg', 'Discord', 'Notion', 'ChatGPT', 'Claude'].map(platform => (
              <span key={platform} className="tag text-xs">{platform}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
