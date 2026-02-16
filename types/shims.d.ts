// Project shims and module declarations to silence third-party missing types






declare module 'recharts' {
  const Recharts: any
  export default Recharts
}

declare module 'recharts/*' {
  const AnyRecharts: any
  export default AnyRecharts
}

declare module 'recharts/es6/chart/BarChart' {
  export const BarChart: any
}

declare module 'recharts/es6/cartesian/Bar' {
  export const Bar: any
}

declare module 'react-resizable-panels' {
  export const PanelGroup: any
  export const Panel: any
  export const PanelResizeHandle: any
  const _default: any
  export default _default
}

declare module 'react-resizable-panels/dist/react-resizable-panels' {
  export const PanelGroup: any
  export const Panel: any
  export const PanelResizeHandle: any
  const _default: any
  export default _default
}

// Deno std import used by edge functions — provide a shim so TS doesn't fail during local type checks
declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export const serve: any
}

declare global {
  interface Window {
    __sentryLoaded?: boolean
  }
}

export {}
