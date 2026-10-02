// Binary min-heap of numeric items keyed by priority. Duplicates are
// allowed, so callers can "decrease a key" by pushing again and skipping
// stale entries when they pop.
export class MinHeap {
  private readonly items: number[] = [];
  private readonly priorities: number[] = [];

  get size(): number {
    return this.items.length;
  }

  // (Sifting moves a hole, not swapping pairs: no arrays made per step, the same order kept, ties too.)
  push(item: number, priority: number): void {
    const items = this.items;
    const priorities = this.priorities;
    let i = items.length;
    items.push(item);
    priorities.push(priority);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (priorities[parent] <= priority) break;
      items[i] = items[parent];
      priorities[i] = priorities[parent];
      i = parent;
    }
    items[i] = item;
    priorities[i] = priority;
  }

  // Returns [item, priority] of the smallest entry. Caller must check size first.
  pop(): [number, number] {
    const items = this.items;
    const priorities = this.priorities;
    const top: [number, number] = [items[0], priorities[0]];
    const lastItem = items.pop()!;
    const lastPriority = priorities.pop()!;
    const n = items.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = -1;
        let least = lastPriority;
        if (left < n && priorities[left] < least) {
          smallest = left;
          least = priorities[left];
        }
        if (right < n && priorities[right] < least) smallest = right;
        if (smallest < 0) break;
        items[i] = items[smallest];
        priorities[i] = priorities[smallest];
        i = smallest;
      }
      items[i] = lastItem;
      priorities[i] = lastPriority;
    }
    return top;
  }
}
