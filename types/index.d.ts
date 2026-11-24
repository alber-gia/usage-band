export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number }
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Snapshot = {
  contextPercent: number | null
  contextTokens: number | null
  contextWindow: number
  limits: Limit[]
  usd: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'usage-band': {
      tokens: Tokens
      turns: number
      skills: Record<string, number>
      snapshot: Snapshot | null
    }
  }
}
