declare module '@studio-freight/lenis' {
  export default class Lenis {
    constructor(options?: Record<string, unknown>);
    raf(time: number): void;
    destroy(): void;
  }
}
