// 'next/dynamic' alias target — passthrough admin components (written for the
// Next web admin) lazy-load heavy client-only widgets (Ketcher, charts) via
// `dynamic(() => import('./Heavy'), { ssr: false, loading })`. On desktop there
// is no SSR, but we still want the same code path: a React.lazy-backed
// component wrapped in Suspense so `{ loading }` renders while the chunk loads.
//
// Contract honored:
//   - loader may resolve to a module (default export) OR the component itself,
//     OR `mod => mod.Named` (the common Ketcher form: import(...).then(m => m.X)).
//   - opts.ssr is ignored (no SSR on desktop).
//   - opts.loading is used as the Suspense fallback (Next calls it with
//     { isLoading, pastDelay, error }; our shim renders <Loading /> propless —
//     the loaders in this codebase ignore those props).
//   - forwardRef: the returned component forwards refs so callers that attach a
//     ref (KetcherStandaloneLoader passes ref through to the wrapper) work.
import * as React from 'react'

type ComponentLike = React.ComponentType<any>
type ModuleOrComponent = ComponentLike | { default: ComponentLike }
type Loader = () => Promise<ModuleOrComponent>

type DynamicOptions = {
  ssr?: boolean
  loading?: React.ComponentType<{
    isLoading?: boolean
    pastDelay?: boolean
    error?: Error | null
  }>
}

function normalizeToComponent(mod: ModuleOrComponent): { default: ComponentLike } {
  // `.then(m => m.Named)` already unwrapped the module to a component; a bare
  // module has it on `.default`. React.lazy requires a `{ default }` shape.
  const comp =
    typeof mod === 'function'
      ? mod
      : ((mod as { default?: ComponentLike }).default ?? (mod as unknown as ComponentLike))
  return { default: comp }
}

export default function dynamic(
  loader: Loader,
  options: DynamicOptions = {},
): React.ComponentType<any> {
  const Lazy = React.lazy(() => loader().then(normalizeToComponent))
  const Loading = options.loading

  const DynamicComponent = React.forwardRef<unknown, Record<string, unknown>>(
    (props, ref) => {
      const fallback = Loading ? React.createElement(Loading, {}) : null
      return React.createElement(
        React.Suspense,
        { fallback },
        React.createElement(Lazy, { ...props, ref }),
      )
    },
  )
  DynamicComponent.displayName = 'NextDynamic'
  return DynamicComponent as React.ComponentType<any>
}
