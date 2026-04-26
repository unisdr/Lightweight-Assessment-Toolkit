import Papa from 'papaparse'

const META_FIELDS = [
  'country', 'country_iso3', 'assessment_id', 'assessment_version',
  'form_definition_url', 'date_started', 'date_saved',
  'respondent_name', 'respondent_role', 'respondent_ministry', 'notes',
]

/**
 * Serialize the current session to save-state CSV.
 * Only indicators that have at least one field populated are included (sparse).
 *
 * @param {object} formDef   Parsed form definition
 * @param {object} meta      Session metadata
 * @param {object} answers   Map of indicatorId → { score, narrative, evidence }
 * @returns {string} CSV text
 */
export function serializeSaveState(formDef, meta, answers) {
  const today = new Date().toISOString().split('T')[0]
  const rows = []

  for (const field of META_FIELDS) {
    rows.push({
      row_type: 'meta',
      id: field,
      score: '',
      value: field === 'date_saved' ? today : (meta[field] || ''),
      narrative: '',
      evidence: '',
    })
  }

  rows.push({
    row_type: 'meta',
    id: 'form_definition_version',
    score: '',
    value: formDef.meta?.version || '',
    narrative: '',
    evidence: '',
  })

  for (const indicator of formDef.indicators) {
    const ans = answers[indicator.id]
    if (!ans || (!ans.score && !ans.narrative && !ans.evidence)) continue
    rows.push({
      row_type: 'indicator',
      id: indicator.id,
      score: ans.score || '',
      value: '',
      narrative: ans.narrative || '',
      evidence: ans.evidence || '',
    })
  }

  return Papa.unparse(rows, {
    columns: ['row_type', 'id', 'score', 'value', 'narrative', 'evidence'],
    quotes: true,
  })
}

/**
 * Build the download filename for a save file or report.
 * Format: <slug>_<country>_<YYYY-MM-DD><ext>
 *
 * @param {object} formDef
 * @param {object} meta
 * @param {string} ext  e.g. '.csv' or '.docx'
 * @returns {string}
 */
export function buildFilename(formDef, meta, ext = '.csv') {
  const slug = (formDef.meta.short_title || 'assessment')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  const country = (meta.country || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const date = new Date().toISOString().split('T')[0]
  return `${slug}_${country}_${date}${ext}`
}
