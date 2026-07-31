export interface PoolOptions {
  concurrency?: number;
}

interface PoolTask<T> {
  item: T;
  index: number;
}

export async function pool<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
  options: PoolOptions = {},
): Promise<R[]> {
  const limit = Math.max(1, options.concurrency ?? 4);
  const queue: Array<PoolTask<T>> = items.map((item, index) => ({ item, index }));
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function drain(): Promise<void> {
    for (;;) {
      const task = queue[cursor];
      cursor += 1;
      if (task === undefined) return;
      results[task.index] = await worker(task.item, task.index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, () => drain()));
  return results;
}
