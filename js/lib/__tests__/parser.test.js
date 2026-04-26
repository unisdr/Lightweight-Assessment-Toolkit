import { describe, it, expect } from 'vitest'
import { parseFormDefinition, parseSaveState } from '../parser.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MINIMAL_FORM_CSV = `\
row_type,id,parent_id,label,description,detail_1,detail_2
meta,title,,,Test Assessment,,
meta,short_title,,,TEST,,
meta,version,,,1.0,,
score_anchor,1,,Early stage,No or very limited capabilities,,
score_anchor,2,,Developing,Some progress made,,
score_anchor,3,,Partially functional,Significant progress,,
score_anchor,4,,Functional,Fully operational,,
domain,D1,,Governance,,,
area,A1,D1,Policy and Strategy,,,
indicator,1,A1,Does a national policy exist?,"Whether a formal policy exists","Policies enable coordination","Is there a policy?
Is it funded?"
indicator,2,A1,Is the policy funded?,"Whether the policy has dedicated budget","Funding enables implementation","Is there a budget line?"`

// ── parseFormDefinition ───────────────────────────────────────────────────────

describe('parseFormDefinition', () => {
  it('reads meta values from the description column (not label)', () => {
    const fd = parseFormDefinition(MINIMAL_FORM_CSV)
    expect(fd.meta.title).toBe('Test Assessment')
    expect(fd.meta.short_title).toBe('TEST')
    expect(fd.meta.version).toBe('1.0')
  })

  it('parses score anchors sorted by id', () => {
    const fd = parseFormDefinition(MINIMAL_FORM_CSV)
    expect(fd.scoreAnchors).toHaveLength(4)
    expect(fd.scoreAnchors[0]).toMatchObject({ id: 1, label: 'Early stage' })
    expect(fd.scoreAnchors[3]).toMatchObject({ id: 4, label: 'Functional' })
  })

  it('parses domain, area, and indicator rows', () => {
    const fd = parseFormDefinition(MINIMAL_FORM_CSV)
    expect(fd.domains).toHaveLength(1)
    expect(fd.domains[0]).toMatchObject({ id: 'D1', label: 'Governance' })
    expect(fd.areas).toHaveLength(1)
    expect(fd.areas[0]).toMatchObject({ id: 'A1', domainId: 'D1' })
    expect(fd.indicators).toHaveLength(2)
  })

  it('builds separate lookup maps per row type (IDs are not globally unique)', () => {
    const fd = parseFormDefinition(MINIMAL_FORM_CSV)
    expect(fd.domainMap['D1']).toBeDefined()
    expect(fd.areaMap['A1']).toBeDefined()
    expect(fd.indicatorMap['1']).toBeDefined()
    // domainMap and areaMap both have id='1' entries without collision
    expect(fd.domainMap['1']).toBeUndefined()
    expect(fd.indicatorMap['D1']).toBeUndefined()
  })

  it('resolves indicator → domain via area (indicatorDomainMap)', () => {
    const fd = parseFormDefinition(MINIMAL_FORM_CSV)
    expect(fd.indicatorDomainMap['1']).toBe('D1')
    expect(fd.indicatorDomainMap['2']).toBe('D1')
  })

  it('preserves multiline guiding questions', () => {
    const fd = parseFormDefinition(MINIMAL_FORM_CSV)
    expect(fd.indicators[0].detail_2).toContain('Is there a policy?')
    expect(fd.indicators[0].detail_2).toContain('Is it funded?')
  })

  it('silently ignores unknown row types', () => {
    const csv = MINIMAL_FORM_CSV + '\nunknown_type,x,,label,desc,,'
    expect(() => parseFormDefinition(csv)).not.toThrow()
  })

  it('handles an empty CSV without throwing', () => {
    expect(() => parseFormDefinition('row_type,id,parent_id,label,description,detail_1,detail_2')).not.toThrow()
  })
})

// ── parseSaveState ────────────────────────────────────────────────────────────

const SAVE_CSV = `\
row_type,id,score,value,narrative,evidence
meta,country,,Indonesia,,
meta,respondent_name,,Jane Doe,,
meta,assessment_version,,1.0,,
indicator,1,3,,Strong institutional framework,Policy document 2022
indicator,2,1,,No budget allocated yet,`

describe('parseSaveState', () => {
  it('extracts known meta fields', () => {
    const { meta } = parseSaveState(SAVE_CSV)
    expect(meta.country).toBe('Indonesia')
    expect(meta.respondent_name).toBe('Jane Doe')
    expect(meta.assessment_version).toBe('1.0')
  })

  it('ignores unknown meta fields', () => {
    const csv = `row_type,id,score,value,narrative,evidence\nmeta,unknown_field,,some value,,`
    const { meta } = parseSaveState(csv)
    expect(meta.unknown_field).toBeUndefined()
  })

  it('parses indicator scores as integers', () => {
    const { answers } = parseSaveState(SAVE_CSV)
    expect(answers['1'].score).toBe(3)
    expect(answers['2'].score).toBe(1)
  })

  it('preserves narrative and evidence text', () => {
    const { answers } = parseSaveState(SAVE_CSV)
    expect(answers['1'].narrative).toBe('Strong institutional framework')
    expect(answers['1'].evidence).toBe('Policy document 2022')
  })

  it('returns null score when score field is empty', () => {
    const csv = `row_type,id,score,value,narrative,evidence\nindicator,5,,,No score yet,`
    const { answers } = parseSaveState(csv)
    expect(answers['5'].score).toBeNull()
  })

  it('produces string keys for indicator ids', () => {
    const { answers } = parseSaveState(SAVE_CSV)
    expect(Object.keys(answers)).toContain('1')
  })

  it('parses form_definition_version meta field', () => {
    const csv = `row_type,id,score,value,narrative,evidence\nmeta,form_definition_version,,1.2.0,,`
    const { meta } = parseSaveState(csv)
    expect(meta.form_definition_version).toBe('1.2.0')
  })
})
