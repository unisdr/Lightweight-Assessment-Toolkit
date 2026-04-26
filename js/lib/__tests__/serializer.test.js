import { describe, it, expect } from 'vitest'
import { serializeSaveState, buildFilename } from '../serializer.js'
import { parseFormDefinition, parseSaveState } from '../parser.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FORM_CSV = `\
row_type,id,parent_id,label,description,detail_1,detail_2
meta,title,,,Test Assessment,,
meta,short_title,,,TEST,,
meta,version,,,1.0,,
score_anchor,1,,Early stage,Desc,,
domain,D1,,Governance,,,
area,A1,D1,Policy and Strategy,,,
indicator,1,A1,Question 1?,"Desc","Why","Guidance"
indicator,2,A1,Question 2?,"Desc","Why","Guidance"`

const formDef = parseFormDefinition(FORM_CSV)

const meta = {
  country: 'Indonesia', country_iso3: 'IDN',
  assessment_id: '', assessment_version: '1.0',
  form_definition_url: '', date_started: '2025-01-01', date_saved: '',
  respondent_name: 'Jane Doe', respondent_role: 'Director',
  respondent_ministry: 'MoHA', notes: '',
}

const answers = {
  '1': { score: 3, narrative: 'Good progress made', evidence: 'Report 2024' },
  // indicator 2 is unanswered — should be omitted from output
}

// ── serializeSaveState ────────────────────────────────────────────────────────

describe('serializeSaveState', () => {
  it('produces a CSV with the correct header row', () => {
    const csv = serializeSaveState(formDef, meta, answers)
    const header = csv.split('\n')[0]
    expect(header).toContain('row_type')
    expect(header).toContain('score')
    expect(header).toContain('narrative')
    expect(header).toContain('evidence')
  })

  it('includes all known meta fields', () => {
    const csv = serializeSaveState(formDef, meta, answers)
    expect(csv).toContain('country')
    expect(csv).toContain('Indonesia')
    expect(csv).toContain('respondent_name')
    expect(csv).toContain('Jane Doe')
  })

  it('omits unanswered indicators (sparse output)', () => {
    const csv = serializeSaveState(formDef, meta, answers)
    const { answers: parsed } = parseSaveState(csv)
    expect(parsed['1']).toBeDefined()
    expect(parsed['2']).toBeUndefined()
  })

  it('round-trips correctly through parseSaveState', () => {
    const csv = serializeSaveState(formDef, meta, answers)
    const { meta: m2, answers: a2 } = parseSaveState(csv)
    expect(m2.country).toBe('Indonesia')
    expect(a2['1'].score).toBe(3)
    expect(a2['1'].narrative).toBe('Good progress made')
    expect(a2['1'].evidence).toBe('Report 2024')
  })

  it('survives commas and double-quotes in text fields', () => {
    const tricky = { '1': { score: 2, narrative: 'He said, "Yes, agreed"', evidence: '' } }
    const csv = serializeSaveState(formDef, meta, tricky)
    const { answers: parsed } = parseSaveState(csv)
    expect(parsed['1'].narrative).toBe('He said, "Yes, agreed"')
  })

  it('overwrites date_saved with today regardless of stored value', () => {
    const metaWithOldDate = { ...meta, date_saved: '1999-01-01' }
    const csv = serializeSaveState(formDef, metaWithOldDate, {})
    const { meta: m2 } = parseSaveState(csv)
    expect(m2.date_saved).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(m2.date_saved).not.toBe('1999-01-01')
  })

  it('includes form_definition_version from formDef.meta.version', () => {
    const csv = serializeSaveState(formDef, meta, answers)
    expect(csv).toContain('form_definition_version')
    const { meta: m2 } = parseSaveState(csv)
    expect(m2.form_definition_version).toBe('1.0')
  })
})

// ── buildFilename ─────────────────────────────────────────────────────────────

describe('buildFilename', () => {
  it("uses short_title slug, country, and today's date", () => {
    const name = buildFilename(formDef, { country: 'Indonesia' }, '.csv')
    expect(name).toMatch(/^test_indonesia_\d{4}-\d{2}-\d{2}\.csv$/)
  })

  it('sanitises special characters in country name', () => {
    const name = buildFilename(formDef, { country: "Côte d'Ivoire" }, '.csv')
    expect(name).not.toMatch(/[^a-z0-9_.\-]/)
  })

  it('falls back to "unknown" when country is empty', () => {
    const name = buildFilename(formDef, { country: '' }, '.csv')
    expect(name).toContain('unknown')
  })

  it('applies the given extension', () => {
    expect(buildFilename(formDef, { country: 'Nepal' }, '.docx')).toMatch(/\.docx$/)
    expect(buildFilename(formDef, { country: 'Nepal' }, '.csv')).toMatch(/\.csv$/)
  })

  it('falls back to "assessment" when short_title is missing', () => {
    const noTitle = { meta: {} }
    expect(buildFilename(noTitle, { country: 'Nepal' }, '.csv')).toMatch(/^assessment_/)
  })
})
