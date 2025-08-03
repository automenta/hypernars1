export class PriorityQueue {
  constructor(comparator = (a, b) => b.budget.priority - a.budget.priority) {
    this.heap = [];
    this.comparator = comparator;
  }

  push(item) {
    this.heap.push(item);
    this._siftUp();
  }

  pop() {
    if (this.heap.length === 0) return null;
    const [top, bottom] = [this.heap[0], this.heap.pop()];
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this._siftDown();
    }
    return top;
  }

  _siftUp() {
    let idx = this.heap.length - 1;
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.comparator(this.heap[idx], this.heap[parent]) < 0) {
        [this.heap[idx], this.heap[parent]] = [this.heap[parent], this.heap[idx]];
        idx = parent;
      } else {
        break;
      }
    }
  }

  peek() {
    return this.heap.length > 0 ? this.heap[0] : undefined;
  }

  get length() {
    return this.heap.length;
  }

  _siftDown(idx = 0) {
    const length = this.heap.length;
    const element = this.heap[idx];

    while (true) {
      let swap = null;
      const left = (idx << 1) + 1;
      const right = left + 1;

      if (left < length && this.comparator(this.heap[left], element) < 0) {
        swap = left;
      }

      if (right < length &&
         (swap === null ? this.comparator(this.heap[right], element) < 0
                        : this.comparator(this.heap[right], this.heap[left]) < 0)) {
        swap = right;
      }

      if (swap === null) break;
      [this.heap[idx], this.heap[swap]] = [this.heap[swap], this.heap[idx]];
      idx = swap;
    }
  }
}
