import Papa from 'papaparse'

/**
 * Parse a form-definition CSV into a structured object.
 *
 * Row types:
 *   meta         — `id` is the field name, value is in `description` (not `label`)
 *   score_anchor — scoring scale entries, sorted by `id`
 *   domain       — top-level grouping
 *   area         — child of domain (parent_id = domain id)
 *   indicator    — leaf question (parent_id = area id)
 *
 * IDs are only unique *within* a row type, not globally.
 *
 * @param {string} csvText
 * @returns {object} formDef
 */
export function parseFormDefinition(csvText) {
  const { data } = Papa.parse(csvText.trim(), { header: true, skipEmptyLines: true })

  const fd = {
    meta: {},
    scoreAnchors: [],
    domains: [],
    areas: [],
    indicators: [],
  }

  for (const row of data) {
    const type = (row.row_type || '').trim()
    switch (type) {
      case 'meta':
        fd.meta[row.id] = row.description || ''
        break
      case 'score_anchor':
        fd.scoreAnchors.push({
          id: parseInt(row.id, 10),
          label: row.label || '',
          description: row.description || '',
        })
        break
      case 'domain':
        fd.domains.push({ id: String(row.id), label: row.label || '' })
        break
      case 'area':
        fd.areas.push({ id: String(row.id), domainId: String(row.parent_id), label: row.label || '' })
        break
      case 'indicator':
        fd.indicators.push({
          id: String(row.id),
          areaId: String(row.parent_id),
          label: row.label || '',
          description: row.description || '',
          detail_1: row.detail_1 || '',
          detail_2: row.detail_2 || '',
        })
        break
      // Unknown row types are silently ignored for forward compatibility
    }
  }

  fd.scoreAnchors.sort((a, b) => a.id - b.id)

  // Separate lookup maps — IDs are only unique within a row type
  fd.domainMap = Object.fromEntries(fd.domains.map(d => [d.id, d]))
  fd.areaMap = Object.fromEntries(fd.areas.map(a => [a.id, a]))
  fd.indicatorMap = Object.fromEntries(fd.indicators.map(i => [i.id, i]))

  // Resolve indicator → domain via area.domainId
  fd.indicatorDomainMap = Object.fromEntries(
    fd.indicators.map(i => [i.id, fd.areaMap[i.areaId]?.domainId ?? null]),
  )

  return fd
}

/**
 * Parse a save-state CSV.
 *
 * @param {string} csvText
 * @returns {{ meta: object, answers: object }}
 */
export function parseSaveState(csvText) {
  const { data } = Papa.parse(csvText.trim(), { header: true, skipEmptyLines: true })

  const KNOWN_META = new Set([
    'country', 'country_iso3', 'assessment_id', 'assessment_version',
    'form_definition_url', 'date_started', 'date_saved',
    'respondent_name', 'respondent_role', 'respondent_ministry', 'notes',
    'form_definition_version',
  ])

  const meta = {}
  const answers = {}

  for (const row of data) {
    const type = (row.row_type || '').trim()
    if (type === 'meta' && KNOWN_META.has(row.id)) {
      meta[row.id] = row.value || ''
    } else if (type === 'indicator') {
      answers[String(row.id)] = {
        score: row.score ? parseInt(row.score, 10) : null,
        narrative: row.narrative || '',
        evidence: row.evidence || '',
      }
    }
  }

  return { meta, answers }
}
