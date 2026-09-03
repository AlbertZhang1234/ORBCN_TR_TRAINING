// Results retain input order; each completion is delivered without waiting for slower items.
export async function mapConcurrent<T, R>(items: readonly T[], concurrency: number,
  work: (item: T, index: number) => Promise<R>, complete?: (result: R, index: number) => void): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('Concurrency must be a positive integer');
  let next = 0;
  const results: R[] = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      const result = await work(items[index], index);
      results[index] = result;
      complete?.(result, index);
    }
  }));
  return results;
}
