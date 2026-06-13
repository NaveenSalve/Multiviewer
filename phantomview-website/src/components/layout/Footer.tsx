import { Heart } from 'lucide-react';

const FOOTER_LINKS = {
  Product: ['Video Matrix', 'Workspace Presets', 'Privacy Engine', 'Resource AI', 'Overlay Modes'],
  Resources: ['Documentation', 'API Reference', 'Changelog', 'System Requirements'],
  Company: ['About', 'Blog', 'Press Kit', 'Contact'],
};

export function Footer() {
  return (
    <footer className="bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <span className="font-heading font-bold text-lg text-neutral-900 dark:text-white">
                PhantomView <span className="text-primary-600">OS</span>
              </span>
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-xs">
              Professional multi-workspace desktop application for monitoring, research, and productivity.
            </p>
          </div>
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-semibold text-sm text-neutral-900 dark:text-white mb-4">{title}</h4>
              <ul className="flex flex-col gap-2.5">
                {links.map(link => (
                  <li key={link}>
                    <a href="#" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-neutral-400 dark:text-neutral-500">
          <span>&copy; {new Date().getFullYear()} PhantomView OS, Inc.</span>
          <span className="flex items-center gap-1.5">
            Made with <Heart className="w-3.5 h-3.5 text-red-500" /> for power users
          </span>
        </div>
      </div>
    </footer>
  );
}
