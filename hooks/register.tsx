import { atom, read, update } from 'claude-code'
import type { Register, SessionContextUsage, SessionCost, SessionRateLimit } from 'claude-code'

import type { Limit, Snapshot, Tokens } from '../types'

// Cambio USD -> EUR usato per convertire la stima di costo (modificare qui).
const EUR_PER_USD = 0.87
// Soglie semaforo, in % del limite: sotto GIALLO verde, sotto ROSSO giallo, oltre rosso.
const GIALLO = 60
const ROSSO = 85

const tokensAtom = atom({ plugin: 'usage-band', key: 'tokens' } as const, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })
const turnsAtom = atom({ plugin: 'usage-band', key: 'turns' } as const, 0)
const skillsAtom = atom({ plugin: 'usage-band', key: 'skills' } as const, {} as Record<string, number>)
const snapAtom = atom({ plugin: 'usage-band', key: 'snapshot' } as const, null as Snapshot | null)

const toSnapshot = (context: SessionContextUsage, rateLimits: SessionRateLimit[], cost?: SessionCost): Snapshot => ({
  contextPercent: context.percent ?? null,
  contextTokens: context.tokens ?? null,
  contextWindow: context.window,
  limits: rateLimits.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt })),
  usd: cost ? cost.usd : null,
})

const semaforo = (pct: number | null): string =>
  pct === null ? 'inactive' : pct >= ROSSO ? 'error' : pct >= GIALLO ? 'warning' : 'success'

const fmtNum = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace('.', ',')} M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')} k`
  return String(n)
}

const fmtPct = (n: number): string => `${Math.round(n)}%`

const fmtOra = (iso?: string): string => {
  if (!iso) return 'n.d.'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'n.d.'
  try {
    return new Intl.DateTimeFormat('it-IT', {
      timeZone: 'Europe/Rome', weekday: 'short', hour: '2-digit', minute: '2-digit',
    }).format(d)
  } catch {
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`
  }
}

const nomeLimite = (kind: string): string =>
  kind === 'five_hour' ? '5h' : kind === 'seven_day' ? '7g' : kind === 'spend_limit' ? 'spesa' : kind

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    const u = await $.session.usage()
    await update($, snapAtom, () => toSnapshot(u.context, u.rateLimits, u.cost))
    return r
  })

  on('session.measure', async ($, e, next) => {
    await update($, snapAtom, () => toSnapshot(e.context, e.rateLimits, e.cost))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    const u = e.usage
    if (u) {
      await update($, tokensAtom, (t: Tokens) => ({
        input: t.input + u.input_tokens,
        output: t.output + u.output_tokens,
        cacheRead: t.cacheRead + u.cache_read_input_tokens,
        cacheWrite: t.cacheWrite + u.cache_creation_input_tokens,
      }))
    }
    if (e.agentId === undefined) await update($, turnsAtom, n => n + 1)
    return r
  })

  on('skill.prompt', async ($, e, next) => {
    await update($, skillsAtom, s => ({ ...s, [e.skill]: (s[e.skill] ?? 0) + 1 }))
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const t = await read($, tokensAtom)
    const turns = await read($, turnsAtom)
    const skills = await read($, skillsAtom)
    const s = await read($, snapAtom)

    const totTok = t.input + t.output + t.cacheRead + t.cacheWrite
    const limits: Limit[] = s?.limits ?? []
    const peggiore = limits.length ? Math.max(...limits.map(l => l.percentUsed)) : null
    const ctxPct = s?.contextPercent ?? null
    const eur = s?.usd == null ? null : s.usd * EUR_PER_USD
    const skillList = Object.entries(skills).map(([k, n]) => (n > 1 ? `${k}×${n}` : k)).join(', ')

    const sep = <Text dimColor>{'  │  '}</Text>

    return (
      <Box flexDirection="row" flexWrap="wrap">
        <Text color={semaforo(peggiore)}>● </Text>
        <Text>Token {fmtNum(totTok)}</Text>
        <Text dimColor> (in {fmtNum(t.input)} / out {fmtNum(t.output)} / cache {fmtNum(t.cacheRead + t.cacheWrite)})</Text>
        {sep}
        {limits.length === 0 ? (
          <Text dimColor>Limiti n.d.</Text>
        ) : (
          limits.map(l => (
            <Text key={l.kind} color={semaforo(l.percentUsed)}>
              {nomeLimite(l.kind)} {fmtPct(l.percentUsed)} → reset {fmtOra(l.resetsAt)}{'  '}
            </Text>
          ))
        )}
        {sep}
        <Text color={semaforo(ctxPct)}>
          Contesto {ctxPct === null ? 'n.d.' : fmtPct(ctxPct)}
          {s?.contextTokens != null ? ` (${fmtNum(s.contextTokens)}/${fmtNum(s.contextWindow)})` : ''}
        </Text>
        {sep}
        <Text>≈ € {eur === null ? 'n.d.' : eur.toFixed(2).replace('.', ',')}</Text>
        <Text dimColor> (stima API)</Text>
        {sep}
        <Text>Turni {turns}</Text>
        {sep}
        <Text>Skill: </Text>
        <Text dimColor>{skillList || 'nessuna'}</Text>
      </Box>
    )
  })
}
