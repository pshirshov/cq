/**
 * A trivial async mutex. Use:
 *   const release = await mutex.acquire();
 *   try { ... } finally { release(); }
 *
 * Or as a wrapper:
 *   await mutex.run(async () => { ... });
 */
export class AsyncMutex {
  private chain: Promise<void> = Promise.resolve();

  async acquire(): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prior = this.chain;
    this.chain = next;
    await prior;
    return release;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }
}
