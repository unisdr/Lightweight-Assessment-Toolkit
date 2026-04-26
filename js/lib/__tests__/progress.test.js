import { describe, it, expect } from 'vitest'
import { calculateProgress } from '../progress.js'
import { parseFormDefinition } from '../parser.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FORM_CSV = `\
row_type,id,parent_id,label,description,detail_1,detail_2
meta,title,,,Test Assessment,,
score_anchor,1,,Early stage,Desc,,
domain,D1,,Governance,,,
domain,D2,,Operations,,,
area,A1,D1,Policy,,,
area,A2,D2,Capacity,,,
indicator,1,A1,Q1?,D,,G
indicator,2,A1,Q2?,D,,G
indicator,3,A2,Q3?,D,,G`

const formDef = parseFormDefinition(FORM_CSV)

// ── calculateProgress ─────────────────────────────────────────────────────────

describe('calculateProgress', () => {
  it('returns zero scored counts when answers is empty', () => {
    const progress = calculateProgress(formDef, {})
    expect(progress['D1']).toEqual({ total: 2, scored: 0 })
    expect(progress['D2']).toEqual({ total: 1, scored: 0 })
  })

  it('returns an entry for every domain', () => {
    const progress = calculateProgress(formDef, {})
    expect(Object.keys(progress)).toEqual(['D1', 'D2'])
  })

  it('counts only indicators that have a score value', () => {
    const answers = {
      '1': { score: 2, narrative: '', evidence: '' },
      '2': { score: null, narrative: 'text only, no score', evidence: '' },
    }
    const progress = calculateProgress(formDef, answers)
    expect(progress['D1'].scored).toBe(1)
    expect(progress['D1'].total).toBe(2)
  })

  it('attributes indicators to the correct domain', () => {
    const answers = { '3': { score: 4, narrative: '', evidence: '' } }
    const progress = calculateProgress(formDef, answers)
    expect(progress['D1'].scored).toBe(0)
    expect(progress['D2'].scored).toBe(1)
  })

  it('counts all indicators as scored when fully answered', () => {
    const answers = {
      '1': { score: 1, narrative: '', evidence: '' },
      '2': { score: 2, narrative: '', evidence: '' },
      '3': { score: 3, narrative: '', evidence: '' },
    }
    const progress = calculateProgress(formDef, answers)
    expect(progress['D1']).toEqual({ total: 2, scored: 2 })
    expect(progress['D2']).toEqual({ total: 1, scored: 1 })
  })
})
