import { type ComponentType, lazy } from 'react';

const resetters = new Set<() => void>();

/** React.lazy 会缓存失败；显式重试必须生成新的 lazy 实例。 */
export function lazyPage(loader: () => Promise<{ default: ComponentType }>) {
  let Page = lazy(loader);
  resetters.add(() => {
    Page = lazy(loader);
  });
  return function LazyPage() {
    return <Page />;
  };
}

export function resetPageImports(): void {
  for (const reset of resetters) reset();
}
