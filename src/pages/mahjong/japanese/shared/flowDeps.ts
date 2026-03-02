/**
 * 可选的流程依赖注入，便于单测或复现时使用确定性随机与同步延时。
 * 不传时使用默认：Math.random、setTimeout/clearTimeout。
 */
export interface RiichiFlowDeps {
  /** 返回 [0, 1)，默认 Math.random */
  rng: () => number;
  /** 安排延时执行，返回取消函数；测试可改为同步执行 */
  schedule: (fn: () => void, ms: number) => () => void;
}

const defaultSchedule = (fn: () => void, ms: number): (() => void) => {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
};

/** 默认依赖：Math.random + setTimeout */
export const defaultFlowDeps: RiichiFlowDeps = {
  rng: () => Math.random(),
  schedule: defaultSchedule,
};

/** 使用 deps 若提供，否则用默认 */
export function getRng(deps?: RiichiFlowDeps | null): () => number {
  return deps?.rng ?? defaultFlowDeps.rng;
}

export function getScheduler(
  deps?: RiichiFlowDeps | null,
): (fn: () => void, ms: number) => () => void {
  return deps?.schedule ?? defaultFlowDeps.schedule;
}
