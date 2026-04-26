import Papa from 'papaparse'
import * as docxLib from 'docx'
import { parseFormDefinition, parseSaveState } from './lib/parser.js'
import { serializeSaveState, buildFilename } from './lib/serializer.js'
import { calculateProgress } from './lib/progress.js'

// ── Application state ─────────────────────────────────────────────────────────

let formDef = null
let meta = {}
let answers = {}
let activeDomainId = null
let activeIndicatorId = null

const STORAGE_KEY = 'lat_autosave_v1'

// ── DOM utility ───────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id)

/**
 * Create and configure a DOM element.
 * Supports className, textContent, innerHTML, htmlFor, and any HTML attribute.
 */
function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') e.className = v
    else if (k === 'textContent') e.textContent = v
    else if (k === 'innerHTML') e.innerHTML = v
    else if (k === 'htmlFor') e.setAttribute('for', v)
    else e.setAttribute(k, v)
  }
  for (const child of children) {
    if (child != null) e.append(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return e
}

// ── Toast notifications ───────────────────────────────────────────────────────

/**
 * @param {string} message
 * @param {'info'|'success'|'warning'|'error'} type
 */
function showToast(message, type = 'info') {
  const toast = el('div', {
    className: `lat-toast lat-toast--${type}`,
    role: 'alert',
    textContent: message,
  })
  $('toasts').appendChild(toast)
  requestAnimationFrame(() => toast.classList.add('is-visible'))
  setTimeout(() => {
    toast.classList.remove('is-visible')
    toast.addEventListener('transitionend', () => toast.remove(), { once: true })
  }, 3500)
}

// ── Modal management ──────────────────────────────────────────────────────────

function openModal(id) {
  const modal = $(id)
  modal.removeAttribute('hidden')
  modal.querySelector('input:not([hidden]), textarea, button')?.focus()
  document.addEventListener('keydown', handleEscape)
}

function closeModal(id) {
  $(id).setAttribute('hidden', '')
  document.removeEventListener('keydown', handleEscape)
}

function handleEscape(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.lat-modal:not([hidden])').forEach(m => closeModal(m.id))
  }
}

// ── Persistence (localStorage) ────────────────────────────────────────────────

function persistState() {
  if (!$('persistence-toggle').checked || !formDef) return
  try {
    localStorage.setItem(STORAGE_KEY, serializeSaveState(formDef, meta, answers))
  } catch {
    // Quota exceeded or storage unavailable — silently ignore
  }
}

// ── Progress & badge helpers ──────────────────────────────────────────────────

function progressText(domainId) {
  const p = calculateProgress(formDef, answers)[domainId]
  return p ? `${p.scored}/${p.total}` : ''
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderTabs() {
  const container = $('domain-tabs')
  container.innerHTML = ''
  for (const domain of formDef.domains) {
    const isActive = domain.id === activeDomainId
    const btn = el('button', {
      className: `lat-tab${isActive ? ' is-active' : ''}`,
      role: 'tab',
      'aria-selected': String(isActive),
      'data-domain': domain.id,
    })
    btn.innerHTML =
      `<span>${domain.label}</span>` +
      `<span class="lat-tab__progress">${progressText(domain.id)}</span>`
    btn.addEventListener('click', () => switchDomain(domain.id))
    container.appendChild(btn)
  }
}

function renderSidebar(domainId) {
  const nav = $('sidebar-nav')
  nav.innerHTML = ''
  const domainAreas = formDef.areas.filter(a => a.domainId === domainId)
  for (const area of domainAreas) {
    const section = el('div', { className: 'lat-sidebar__section' })
    section.appendChild(el('div', { className: 'lat-sidebar__area', textContent: area.label }))
    for (const indicator of formDef.indicators.filter(i => i.areaId === area.id)) {
      section.appendChild(makeSidebarItem(indicator))
    }
    nav.appendChild(section)
  }
}

function makeSidebarItem(indicator) {
  const ans = answers[indicator.id]
  const score = ans?.score ? String(ans.score) : ''
  const btn = el('button', {
    className: `lat-sidebar__item${indicator.id === activeIndicatorId ? ' is-active' : ''}`,
    'data-indicator': indicator.id,
  })
  btn.innerHTML =
    `<span class="lat-sidebar__item-label">${indicator.label}</span>` +
    (score ? `<span class="lat-score-badge lat-score-badge--${score}">${score}</span>` : '')
  btn.addEventListener('click', () => showIndicator(indicator.id))
  return btn
}

function renderContent(indicatorId) {
  const main = $('content-area')
  main.innerHTML = ''

  if (!indicatorId) {
    main.appendChild(el('p', { className: 'lat-content__empty', textContent: 'Select an indicator from the sidebar.' }))
    return
  }

  const indicator = formDef.indicatorMap[indicatorId]
  const ans = answers[indicatorId] ?? { score: null, narrative: '', evidence: '' }
  const card = el('div', { className: 'lat-card' })

  // Question
  card.appendChild(el('h2', { className: 'lat-card__title', textContent: indicator.label }))

  if (indicator.description) {
    card.appendChild(el('p', { className: 'lat-card__description', textContent: indicator.description }))
  }

  if (indicator.detail_1) {
    card.appendChild(makeCollapsible('Why it matters', el('p', { textContent: indicator.detail_1 })))
  }

  if (indicator.detail_2) {
    const lines = indicator.detail_2.split('\n').map(l => l.trim()).filter(Boolean)
    const list = el('ul', { className: 'lat-card__detail-list' })
    lines.forEach(line => list.appendChild(el('li', { textContent: line })))
    card.appendChild(makeCollapsible('Guiding questions', list))
  }

  // Score radios
  const fieldset = el('fieldset', { className: 'lat-score-group' })
  fieldset.appendChild(el('legend', { className: 'lat-score-group__legend', textContent: 'Score' }))
  const optionsWrap = el('div', { className: 'lat-score-options' })
  for (const anchor of formDef.scoreAnchors) {
    const optId = `score-${indicatorId}-${anchor.id}`
    const wrap = el('div', { className: 'lat-score-option' })
    const radio = el('input', {
      type: 'radio',
      className: 'mg-form-check__input mg-form-check__input--radio lat-score-radio',
      id: optId,
      name: `score-${indicatorId}`,
      value: String(anchor.id),
    })
    if (ans.score === anchor.id) radio.checked = true
    radio.addEventListener('change', () => setAnswer(indicatorId, 'score', anchor.id))

    const label = el('label', { className: 'lat-score-label', htmlFor: optId })
    label.innerHTML =
      `<span class="lat-score-badge lat-score-badge--${anchor.id}">${anchor.id}</span>` +
      `<span class="lat-score-text"><strong>${anchor.label}</strong>` +
      `<span class="lat-score-anchor-desc">${anchor.description}</span></span>`

    wrap.appendChild(radio)
    wrap.appendChild(label)
    optionsWrap.appendChild(wrap)
  }
  fieldset.appendChild(optionsWrap)
  card.appendChild(fieldset)

  // Narrative
  card.appendChild(makeTextareaField(
    `narrative-${indicatorId}`, 'Narrative',
    ans.narrative, 4, 'Explain the basis for your score…',
    val => setAnswer(indicatorId, 'narrative', val),
  ))

  // Evidence
  card.appendChild(makeTextareaField(
    `evidence-${indicatorId}`, 'Evidence / sources',
    ans.evidence, 3, 'Documents, reports, URLs…',
    val => setAnswer(indicatorId, 'evidence', val),
  ))

  // Prev / Next navigation
  const domainIndicators = formDef.indicators.filter(
    i => formDef.indicatorDomainMap[i.id] === activeDomainId,
  )
  const idx = domainIndicators.findIndex(i => i.id === indicatorId)
  const navRow = el('div', { className: 'lat-card__nav' })

  if (idx > 0) {
    const prev = el('button', { className: 'mg-button mg-button-secondary', textContent: '← Previous' })
    prev.addEventListener('click', () => showIndicator(domainIndicators[idx - 1].id))
    navRow.appendChild(prev)
  } else {
    navRow.appendChild(el('span'))
  }

  if (idx < domainIndicators.length - 1) {
    const next = el('button', { className: 'mg-button mg-button-primary', textContent: 'Next →' })
    next.addEventListener('click', () => showIndicator(domainIndicators[idx + 1].id))
    navRow.appendChild(next)
  } else {
    navRow.appendChild(el('span'))
  }

  card.appendChild(navRow)
  main.appendChild(card)
}

function makeCollapsible(summary, contentEl) {
  const details = el('details', { className: 'lat-card__details' })
  details.appendChild(el('summary', { className: 'lat-card__summary', textContent: summary }))
  details.appendChild(contentEl)
  return details
}

function makeTextareaField(id, labelText, value, rows, placeholder, onInput) {
  const group = el('div', { className: 'mg-form-field' })
  group.appendChild(el('label', { className: 'mg-form-label', htmlFor: id, textContent: labelText }))
  const ta = el('textarea', {
    className: 'mg-form-textarea lat-card__textarea',
    id,
    rows: String(rows),
    placeholder,
  })
  ta.value = value || ''
  ta.addEventListener('input', () => onInput(ta.value))
  group.appendChild(ta)
  return group
}

// ── Header ────────────────────────────────────────────────────────────────────

function updateHeader() {
  $('header-title').textContent = formDef?.meta?.title || 'Assessment'
  const parts = [meta.country, meta.respondent_name].filter(Boolean)
  $('header-meta').textContent = parts.join(' · ')
}

// ── State mutations ───────────────────────────────────────────────────────────

function setAnswer(indicatorId, field, value) {
  if (!answers[indicatorId]) answers[indicatorId] = { score: null, narrative: '', evidence: '' }
  answers[indicatorId][field] = value
  refreshSidebarItem(indicatorId)
  refreshTabBadge(formDef.indicatorDomainMap[indicatorId])
  persistState()
}

function refreshSidebarItem(indicatorId) {
  const btn = $('sidebar-nav').querySelector(`[data-indicator="${indicatorId}"]`)
  if (!btn) return
  const ans = answers[indicatorId]
  const score = ans?.score ? String(ans.score) : ''
  btn.innerHTML =
    `<span class="lat-sidebar__item-label">${formDef.indicatorMap[indicatorId].label}</span>` +
    (score ? `<span class="lat-score-badge lat-score-badge--${score}">${score}</span>` : '')
}

function refreshTabBadge(domainId) {
  const btn = $('domain-tabs').querySelector(`[data-domain="${domainId}"]`)
  if (!btn) return
  const badge = btn.querySelector('.lat-tab__progress')
  if (badge) badge.textContent = progressText(domainId)
}

function switchDomain(domainId) {
  activeDomainId = domainId
  const first = formDef.indicators.find(i => formDef.indicatorDomainMap[i.id] === domainId)
  activeIndicatorId = first?.id ?? null
  renderTabs()
  renderSidebar(domainId)
  renderContent(activeIndicatorId)
}

function showIndicator(indicatorId) {
  activeIndicatorId = indicatorId
  $('sidebar-nav').querySelectorAll('.lat-sidebar__item').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.indicator === indicatorId)
  })
  renderContent(indicatorId)
  $('content-area').focus()
}

// ── App launch (form definition) ──────────────────────────────────────────────

function launchApp(parsedFormDef) {
  formDef = parsedFormDef
  activeDomainId = formDef.domains[0]?.id ?? null
  activeIndicatorId = formDef.indicators.find(
    i => formDef.indicatorDomainMap[i.id] === activeDomainId,
  )?.id ?? null

  $('welcome').setAttribute('hidden', '')
  $('app').removeAttribute('hidden')
  updateHeader()
  renderTabs()
  renderSidebar(activeDomainId)
  renderContent(activeIndicatorId)
}

function handleFormDefFile(file) {
  const reader = new FileReader()
  reader.onload = e => {
    try {
      const parsed = parseFormDefinition(e.target.result)
      meta = {}
      answers = {}
      launchApp(parsed)
      $('form-def-filename').textContent = file.name
      showToast('Form definition loaded', 'success')
    } catch (err) {
      showToast(`Could not parse form definition: ${err.message}`, 'error')
    }
  }
  reader.readAsText(file)
}

// ── Save-state file ───────────────────────────────────────────────────────────

function handleSaveStateFile(file) {
  if (!formDef) {
    showToast('Load a form definition first', 'warning')
    return
  }
  const reader = new FileReader()
  reader.onload = e => {
    try {
      const { meta: loadedMeta, answers: loadedAnswers } = parseSaveState(e.target.result)
      const unknownIds = Object.keys(loadedAnswers).filter(id => !formDef.indicatorMap[id])
      if (unknownIds.length) {
        showToast(
          `${unknownIds.length} indicator(s) in save file not found in the current form definition — skipped`,
          'warning',
        )
      }
      meta = loadedMeta
      answers = {}
      for (const [id, ans] of Object.entries(loadedAnswers)) {
        if (formDef.indicatorMap[id]) answers[id] = ans
      }
      updateHeader()
      renderTabs()
      renderSidebar(activeDomainId)
      renderContent(activeIndicatorId)
      showToast('Save file loaded', 'success')
    } catch (err) {
      showToast(`Could not parse save file: ${err.message}`, 'error')
    }
  }
  reader.readAsText(file)
}

// ── Save to file ──────────────────────────────────────────────────────────────

function saveToFile() {
  const csv = serializeSaveState(formDef, meta, answers)
  const filename = buildFilename(formDef, meta, '.csv')
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename)
  showToast(`Saved as ${filename}`, 'success')
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Word report ────────────────────────────────────────────────────────────────

function loadDocxLib() {
  return Promise.resolve(docxLib)
}

async function buildReport() {
  const btn = $('btn-report')
  btn.disabled = true
  showToast('Generating report…', 'info')

  try {
    const {
      Document, Packer, Paragraph, TextRun, HeadingLevel,
      Table, TableRow, TableCell, WidthType, BorderStyle,
    } = await loadDocxLib()

    const noBorder = { style: BorderStyle.NONE, size: 0, color: 'auto' }
    const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }

    const sections = []

    // Title
    sections.push(new Paragraph({ text: formDef.meta.title || 'Assessment Report', heading: HeadingLevel.TITLE }))
    sections.push(new Paragraph({ text: '' }))

    // Metadata summary table
    const metaRows = [
      ['Country', meta.country || '—'],
      ['ISO3 code', meta.country_iso3 || '—'],
      ['Respondent', meta.respondent_name || '—'],
      ['Role', meta.respondent_role || '—'],
      ['Organisation', meta.respondent_ministry || '—'],
      ['Date', meta.date_saved || new Date().toISOString().split('T')[0]],
    ]
    sections.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: metaRows.map(([k, v]) => new TableRow({
        children: [
          new TableCell({
            borders: noBorders,
            children: [new Paragraph({ children: [new TextRun({ text: k, bold: true })] })],
          }),
          new TableCell({
            borders: noBorders,
            children: [new Paragraph({ children: [new TextRun(v)] })],
          }),
        ],
      })),
    }))
    sections.push(new Paragraph({ text: '' }))

    // Per-domain content
    for (const domain of formDef.domains) {
      const progress = calculateProgress(formDef, answers)[domain.id]
      sections.push(new Paragraph({ text: domain.label, heading: HeadingLevel.HEADING_1, pageBreakBefore: true }))
      sections.push(new Paragraph({
        children: [new TextRun({ text: `Progress: ${progress.scored}/${progress.total} indicators scored`, italics: true })],
      }))

      for (const area of formDef.areas.filter(a => a.domainId === domain.id)) {
        sections.push(new Paragraph({ text: area.label, heading: HeadingLevel.HEADING_2 }))

        for (const indicator of formDef.indicators.filter(i => i.areaId === area.id)) {
          const ans = answers[indicator.id] ?? {}
          const anchor = formDef.scoreAnchors.find(s => s.id === ans.score)

          sections.push(new Paragraph({ text: indicator.label, heading: HeadingLevel.HEADING_3 }))

          if (ans.score) {
            sections.push(new Paragraph({
              children: [
                new TextRun({ text: 'Score: ', bold: true }),
                new TextRun(`${ans.score} — ${anchor?.label ?? ''}`),
              ],
            }))
          } else {
            sections.push(new Paragraph({
              children: [new TextRun({ text: 'Not yet scored', italics: true, color: '888888' })],
            }))
          }

          if (ans.narrative) {
            sections.push(new Paragraph({
              children: [new TextRun({ text: 'Narrative: ', bold: true }), new TextRun(ans.narrative)],
            }))
          }
          if (ans.evidence) {
            sections.push(new Paragraph({
              children: [new TextRun({ text: 'Evidence: ', bold: true }), new TextRun(ans.evidence)],
            }))
          }
        }
      }
    }

    const doc = new Document({ sections: [{ children: sections }] })
    const blob = await Packer.toBlob(doc)
    const filename = buildFilename(formDef, meta, '.docx')
    downloadBlob(blob, filename)
    showToast(`Report downloaded as ${filename}`, 'success')
  } catch (err) {
    showToast(`Report generation failed: ${err.message}`, 'error')
  } finally {
    btn.disabled = false
  }
}

// ── Details modal ──────────────────────────────────────────────────────────────

function populateDetailsForm() {
  const form = $('form-details')
  for (const [key, val] of Object.entries(meta)) {
    const field = form.elements[key]
    if (field) field.value = val
  }
}

function readDetailsForm() {
  const form = $('form-details')
  for (const [key, val] of new FormData(form).entries()) {
    meta[key] = String(val)
  }
  if (meta.country_iso3) meta.country_iso3 = meta.country_iso3.toUpperCase()
}

// ── New assessment ────────────────────────────────────────────────────────────

function resetToWelcome() {
  formDef = null
  meta = {}
  answers = {}
  activeDomainId = null
  activeIndicatorId = null
  $('app').setAttribute('hidden', '')
  $('welcome').removeAttribute('hidden')
  $('form-def-filename').textContent = 'No file selected'
}

// ── Drag-and-drop ─────────────────────────────────────────────────────────────

function initDropZone() {
  let depth = 0
  let hideTimer = null

  function showOverlay() {
    clearTimeout(hideTimer)
    const isWelcome = !$('welcome').hasAttribute('hidden')
    $('drop-overlay-text').textContent = isWelcome
      ? 'Drop CSV to load form definition'
      : 'Drop CSV to restore session'
    $('drop-overlay').classList.add('is-active')
  }

  function hideOverlay() {
    // Small delay avoids flicker when cursor briefly leaves one child and enters another
    hideTimer = setTimeout(() => $('drop-overlay').classList.remove('is-active'), 60)
  }

  document.addEventListener('dragenter', e => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    depth++
    if (depth === 1) showOverlay()
  })

  document.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  })

  document.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1)
    if (depth === 0) hideOverlay()
  })

  document.addEventListener('drop', e => {
    e.preventDefault()
    depth = 0
    $('drop-overlay').classList.remove('is-active')
    clearTimeout(hideTimer)

    const file = Array.from(e.dataTransfer.files).find(f =>
      f.name.toLowerCase().endsWith('.csv'),
    )
    if (!file) {
      showToast('Please drop a .csv file', 'warning')
      return
    }

    const isWelcome = !$('welcome').hasAttribute('hidden')
    if (isWelcome) {
      handleFormDefFile(file)
    } else {
      handleSaveStateFile(file)
    }
  })
}

// ── Init ───────────────────────────────────────────────────────────────────────

function init() {
  // Form definition file picker
  $('input-form-def').addEventListener('change', e => {
    const file = e.target.files[0]
    if (file) handleFormDefFile(file)
    e.target.value = ''
  })

  // Save-state file picker
  $('input-save-state').addEventListener('change', e => {
    const file = e.target.files[0]
    if (file) handleSaveStateFile(file)
    e.target.value = ''
  })

  // Toolbar buttons
  $('btn-details').addEventListener('click', () => {
    populateDetailsForm()
    openModal('modal-details')
  })

  $('btn-save').addEventListener('click', () => {
    if (!formDef) return
    saveToFile()
  })

  $('btn-report').addEventListener('click', () => {
    if (!formDef) return
    buildReport()
  })

  $('btn-new').addEventListener('click', () => openModal('modal-new'))

  $('btn-new-confirm').addEventListener('click', () => {
    resetToWelcome()
    closeModal('modal-new')
    showToast('Assessment cleared — ready to start fresh', 'info')
  })

  // Details form submit
  $('form-details').addEventListener('submit', e => {
    e.preventDefault()
    readDetailsForm()
    closeModal('modal-details')
    updateHeader()
    showToast('Details saved', 'success')
  })

  // Modal close via backdrop click or Cancel buttons (data-close-modal attribute)
  document.addEventListener('click', e => {
    const target = e.target.closest('[data-close-modal]')
    if (target) closeModal(target.dataset.closeModal)
  })

  // Auto-save toggle: persist immediately when enabled
  $('persistence-toggle').addEventListener('change', () => {
    if ($('persistence-toggle').checked) persistState()
  })

  initDropZone()
}

init()
