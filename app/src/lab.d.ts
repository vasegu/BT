declare module "*lab/logic.mjs" {
  export function retrieve<T extends { id: string; vector: number[] }>(
    records: T[],
    query: { vector: number[] },
  ): (T & { similarity: number })[];
}
