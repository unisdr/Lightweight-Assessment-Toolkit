/**
 * Calculate per-domain scoring progress.
 *
 * @param {object} formDef
 * @param {object} answers  Map of indicatorId → { score, narrative, evidence }
 * @returns {object} Map of domainId → { total: number, scored: number }
 */
export function calculateProgress(formDef, answers) {
  const result = {}
  for (const domain of formDef.domains) {
    const domainIndicators = formDef.indicators.filter(
      i => formDef.indicatorDomainMap[i.id] === domain.id,
    )
    result[domain.id] = {
      total: domainIndicators.length,
      scored: domainIndicators.filter(i => answers[i.id]?.score).length,
    }
  }
  return result
}
