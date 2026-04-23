import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useApp } from '../store/AppContext'
import { createIssueProvider } from '../providers/IssueProviders'

const STORAGE_KEY = 'devdash-schedule-v1'

// ─── 금주 날짜 범위 (월~일) ───────────────────────────────────────
function getWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7))
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt = d =>
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  return { start: fmt(mon), end: fmt(sun) }
}

function loadSchedule() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function shortMsg(msg = '') {
  return msg.split('\n')[0].slice(0, 60)
}

function fmtDate(dateStr = '') {
  if (!dateStr) return ''
  const s = String(dateStr)
  // ISO string이면 앞 10자(YYYY-MM-DD)만
  return s.slice(5, 10)
}

// ─── 이슈 상태 → 색상 ─────────────────────────────────────────────
function statusColor(status = '') {
  const s = status.toLowerCase()
  if (s.includes('done') || s.includes('closed') || s.includes('resolved') ||
      s.includes('완료') || s.includes('해결')) return '#2a7a4a'
  if (s.includes('progress') || s.includes('진행') || s.includes('review') ||
      s.includes('검토')) return '#1a4a7a'
  if (s.includes('block') || s.includes('차단')) return '#7a2a2a'
  return '#2a3a4a'
}

// ─── AI 프롬프트 빌더 ──────────────────────────────────────────────
function buildPrompt({ commits, issues, resolvedIssues, start, end }) {
  const svnItems = Object.values(commits.svn).flatMap(r => r.items || [])
  const gitItems = Object.values(commits.git).flatMap(r => r.items || [])
  const weekCommits = [...svnItems, ...gitItems]
    .filter(c => c.date && c.date >= start && c.date <= end)
    .map(c => `- [${c.type === 'svn' ? `r${c.revision}` : c.hash}] ${c.message}`)
    .join('\n') || '(이번 주 커밋 없음)'

  const issueList = issues.items
    .map(i => `- [${i.provider}] ${i.id}: ${i.title} (${i.status})`)
    .join('\n') || '(미해결 이슈 없음)'

  const resolvedList = resolvedIssues.length > 0
    ? resolvedIssues.map(i => `- [${i.provider}] ${i.id}: ${i.title}`).join('\n')
    : '(이번 주 완료 이슈 없음)'

  const scheduleList = loadSchedule()
    .filter(s => s.date >= start && s.date <= end)
    .map(s => `- ${s.date} ${s.allDay ? '(종일)' : s.time} ${s.title}`)
    .join('\n') || '(일정 없음)'

  return `당신은 개발자의 주간 업무를 정리해주는 어시스턴트입니다.
아래 이번 주(${start} ~ ${end}) 데이터를 바탕으로 한국어 주간 업무 보고를 작성해주세요.

[이번 주 커밋 로그]
${weekCommits}

[현재 미해결 이슈]
${issueList}

[이번 주 완료된 이슈]
${resolvedList}

[이번 주 일정]
${scheduleList}

작성 형식:
1. **이번 주 완료 작업** — 커밋 + 완료 이슈 기반으로 간결하게
2. **진행 중 / 이슈** — 현재 미해결 이슈 상태
3. **다음 주 예정** — 이슈와 일정 기반
4. **한 줄 요약** — 전체 주간을 한 문장으로

간결하고 실무적으로 작성해주세요.`
}

// ─── 섹션 헤더 (접기/펼치기) ─────────────────────────────────────
function SectionHeader({ title, count, open, onToggle, extra }) {
  return (
    <div style={s.sectionHeader} onClick={onToggle}>
      <span style={s.sectionChevron}>{open ? '▾' : '▸'}</span>
      <span style={s.sectionTitle}>{title}</span>
      {count != null && <span style={s.sectionCount}>{count}</span>}
      {extra}
    </div>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────────────
export default function WeeklySummaryPage() {
  const { state } = useApp()
  const { start, end } = getWeekRange()

  // ── AI 요약 ──────────────────────────────────────────────────────
  const [summary, setSummary] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError,   setAiError  ] = useState('')
  const [copied,    setCopied   ] = useState(false)

  // ── 완료 이슈 ────────────────────────────────────────────────────
  const [resolvedIssues,   setResolvedIssues  ] = useState([])
  const [resolvedLoading,  setResolvedLoading ] = useState(false)

  // ── 섹션 접기 상태 ───────────────────────────────────────────────
  const [commitOpen,   setCommitOpen  ] = useState(true)
  const [issueOpen,    setIssueOpen   ] = useState(true)
  const [resolvedOpen, setResolvedOpen] = useState(true)
  const [aiOpen,       setAiOpen      ] = useState(true)

  // ── 금주 커밋 ────────────────────────────────────────────────────
  const weekCommits = useMemo(() => {
    const svn = Object.values(state.commits.svn).flatMap(r => r.items || [])
    const git = Object.values(state.commits.git).flatMap(r => r.items || [])
    return [...svn, ...git]
      .filter(c => c.date && c.date >= start && c.date <= end)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [state.commits, start, end])

  const svnCount = useMemo(() =>
    Object.values(state.commits.svn).flatMap(r => r.items || [])
      .filter(c => c.date && c.date >= start && c.date <= end).length
  , [state.commits.svn, start, end])

  const gitCount = useMemo(() =>
    Object.values(state.commits.git).flatMap(r => r.items || [])
      .filter(c => c.date && c.date >= start && c.date <= end).length
  , [state.commits.git, start, end])

  // ── 완료 이슈 fetch (마운트 시 1회) ─────────────────────────────
  const fetchResolved = useCallback(async () => {
    if (!state.config) return
    setResolvedLoading(true)
    const results = []

    try {
      if (state.config.mantis?.enabled && state.config.mantis?.baseUrl) {
        const provider = createIssueProvider('mantis', state.config.mantis)
        const items = await provider.getResolvedThisWeek(start)
        results.push(...items)
      }
      if (state.config.jira?.enabled && state.config.jira?.baseUrl) {
        const provider = createIssueProvider('jira', state.config.jira)
        const items = await provider.getResolvedThisWeek(start)
        results.push(...items)
      }
    } catch (e) {
      console.warn('[WeeklySummary] resolved fetch error:', e.message)
    }

    setResolvedIssues(results)
    setResolvedLoading(false)
  }, [state.config, start])

  useEffect(() => {
    fetchResolved()
  }, [fetchResolved])

  // ── AI 요약 생성 ─────────────────────────────────────────────────
  const generate = useCallback(async () => {
    const apiKey = state.config?.ai?.anthropicKey
    if (!apiKey) { setAiError('설정에서 Anthropic API 키를 입력해주세요.'); return }
    setAiLoading(true); setAiError(''); setSummary('')
    try {
      const prompt = buildPrompt({
        commits: state.commits, issues: state.issues, resolvedIssues, start, end,
      })
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || `API error ${res.status}`)
      }
      const data = await res.json()
      setSummary(data.content?.map(c => c.text || '').join('') || '')
      setAiOpen(true)
    } catch (e) {
      setAiError(e.message)
    } finally {
      setAiLoading(false)
    }
  }, [state, resolvedIssues, start, end])

  const copy = () => {
    navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // ── 이슈 상태 분포 ───────────────────────────────────────────────
  const statusGroups = useMemo(() => {
    const map = {}
    for (const issue of state.issues.items) {
      map[issue.status] = (map[issue.status] || 0) + 1
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [state.issues.items])

  return (
    <div style={s.page}>
      {/* ── 헤더 ─────────────────────────────────────── */}
      <div style={s.header}>
        <div>
          <div style={s.title}>주간 요약</div>
          <div style={s.sub}>{start} ~ {end}</div>
        </div>
        <button style={s.genBtn} onClick={generate} disabled={aiLoading}>
          {aiLoading ? '생성 중...' : '✦ AI 요약 생성'}
        </button>
      </div>

      {/* ── 통계 카드 ─────────────────────────────────── */}
      <div style={s.statsRow}>
        <div style={s.statCard}>
          <div style={s.statVal}>{weekCommits.length}</div>
          <div style={s.statLbl}>금주 커밋</div>
          {(svnCount > 0 || gitCount > 0) && (
            <div style={s.statSub}>
              {svnCount > 0 && <span>SVN {svnCount}</span>}
              {svnCount > 0 && gitCount > 0 && <span>·</span>}
              {gitCount > 0 && <span>Git {gitCount}</span>}
            </div>
          )}
        </div>
        <div style={s.statDivider} />
        <div style={s.statCard}>
          <div style={s.statVal}>{state.issues.items.length}</div>
          <div style={s.statLbl}>미해결 이슈</div>
          {statusGroups.slice(0, 2).map(([st, cnt]) => (
            <div key={st} style={s.statSub}><span>{st} {cnt}</span></div>
          ))}
        </div>
        <div style={s.statDivider} />
        <div style={s.statCard}>
          <div style={{ ...s.statVal, color: '#4aaa7a' }}>
            {resolvedLoading ? '…' : resolvedIssues.length}
          </div>
          <div style={s.statLbl}>금주 완료</div>
          <div style={s.statSub}><span>처리된 이슈</span></div>
        </div>
      </div>

      {/* ── 스크롤 바디 ───────────────────────────────── */}
      <div style={s.body}>

        {/* 금주 커밋 섹션 */}
        <SectionHeader
          title="금주 커밋"
          count={weekCommits.length}
          open={commitOpen}
          onToggle={() => setCommitOpen(v => !v)}
        />
        {commitOpen && (
          <div style={s.sectionBody}>
            {weekCommits.length === 0 ? (
              <div style={s.empty}>이번 주 커밋이 없습니다</div>
            ) : (
              weekCommits.map((c, i) => (
                <div key={`${c.hash || c.revision}-${i}`} style={s.commitRow}>
                  <span style={{
                    ...s.commitTag,
                    background: c.type === 'svn' ? '#1a3030' : '#1a2040',
                  }}>
                    {c.type === 'svn' ? `r${c.revision}` : (c.hash || '').slice(0, 7)}
                  </span>
                  <span style={s.commitMsg}>{shortMsg(c.message)}</span>
                  <span style={s.commitDate}>{fmtDate(c.date)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* 미해결 이슈 섹션 */}
        <SectionHeader
          title="담당 미해결 이슈"
          count={state.issues.items.length}
          open={issueOpen}
          onToggle={() => setIssueOpen(v => !v)}
          extra={state.issues.loading && <span style={s.loadingDot}>●</span>}
        />
        {issueOpen && (
          <div style={s.sectionBody}>
            {state.issues.error && (
              <div style={s.errText}>{state.issues.error}</div>
            )}
            {!state.issues.loading && state.issues.items.length === 0 && !state.issues.error && (
              <div style={s.empty}>미해결 이슈가 없습니다</div>
            )}
            {state.issues.items.map(issue => (
              <div key={issue.id} style={s.issueRow}>
                <span style={s.issueProvider}>{issue.provider}</span>
                <span style={s.issueId}>{issue.id}</span>
                <span style={s.issueTitle}>{issue.title}</span>
                <span style={{
                  ...s.issueBadge,
                  background: statusColor(issue.status),
                }}>
                  {issue.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 완료 이슈 섹션 */}
        <SectionHeader
          title="금주 완료된 이슈"
          count={resolvedLoading ? null : resolvedIssues.length}
          open={resolvedOpen}
          onToggle={() => setResolvedOpen(v => !v)}
          extra={resolvedLoading && <span style={s.loadingDot}>●</span>}
        />
        {resolvedOpen && (
          <div style={s.sectionBody}>
            {!resolvedLoading && resolvedIssues.length === 0 && (
              <div style={s.empty}>이번 주 완료된 이슈가 없습니다</div>
            )}
            {resolvedIssues.map(issue => (
              <div key={issue.id} style={s.issueRow}>
                <span style={s.issueProvider}>{issue.provider}</span>
                <span style={s.issueId}>{issue.id}</span>
                <span style={s.issueTitle}>{issue.title}</span>
                <span style={{ ...s.issueBadge, background: '#2a6a4a' }}>
                  {issue.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* AI 요약 섹션 */}
        <SectionHeader
          title="AI 요약"
          count={null}
          open={aiOpen}
          onToggle={() => setAiOpen(v => !v)}
        />
        {aiOpen && (
          <div style={s.sectionBody}>
            {aiLoading && (
              <div style={s.loadWrap}>
                <div style={s.spinner} />
                <p style={s.loadMsg}>커밋, 이슈, 일정을 분석하는 중...</p>
              </div>
            )}
            {aiError && <div style={s.errText}>{aiError}</div>}
            {summary && (
              <div style={s.resultWrap}>
                <div style={s.resultActions}>
                  <button style={s.copyBtn} onClick={copy}>
                    {copied ? '✓ 복사됨' : '클립보드 복사'}
                  </button>
                </div>
                <pre style={s.result}>{summary}</pre>
              </div>
            )}
            {!aiLoading && !summary && !aiError && (
              <div style={s.aiHint}>
                상단 버튼을 눌러 이번 주 업무를 AI로 요약합니다
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ─── 스타일 ───────────────────────────────────────────────────────
const s = {
  page: {
    height: '100%', display: 'flex', flexDirection: 'column',
    background: '#13151c', color: '#c0cce0',
    fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif",
  },

  // 헤더
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 20px', borderBottom: '1px solid #1e2130', flexShrink: 0,
  },
  title: { fontSize: 15, color: '#d0d8ea', fontWeight: 600 },
  sub:   { fontSize: 11, color: '#445', marginTop: 3 },
  genBtn: {
    background: '#182840', border: '1px solid #2a4a70', borderRadius: 6,
    color: '#7ab0d8', fontSize: 12, padding: '7px 16px', cursor: 'pointer',
    transition: 'background .15s',
  },

  // 통계 카드
  statsRow: {
    display: 'flex', alignItems: 'stretch', padding: '12px 20px',
    borderBottom: '1px solid #1e2130', flexShrink: 0, gap: 0,
  },
  statCard: { flex: 1, textAlign: 'center', padding: '4px 0' },
  statVal:  { fontSize: 24, fontWeight: 700, color: '#8ab4d8', lineHeight: 1.1 },
  statLbl:  { fontSize: 10, color: '#556', marginTop: 3 },
  statSub:  {
    fontSize: 9, color: '#3a4a5a', marginTop: 2,
    display: 'flex', justifyContent: 'center', gap: 4,
  },
  statDivider: { width: 1, background: '#1e2130', margin: '0 8px', flexShrink: 0 },

  // 스크롤 바디
  body: { flex: 1, overflowY: 'auto', padding: '0 0 24px' },

  // 섹션
  sectionHeader: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 20px 8px',
    borderBottom: '1px solid #1a1e2a',
    cursor: 'pointer', userSelect: 'none',
    background: '#161924',
    position: 'sticky', top: 0, zIndex: 1,
  },
  sectionChevron: { fontSize: 10, color: '#445', flexShrink: 0 },
  sectionTitle:   { fontSize: 11, fontWeight: 600, color: '#8a9ab0', letterSpacing: '.04em' },
  sectionCount:   {
    fontSize: 10, color: '#fff', background: '#2a3a5a',
    borderRadius: 10, padding: '1px 7px', marginLeft: 2,
  },
  loadingDot: {
    fontSize: 8, color: '#4a9eff', marginLeft: 4, animation: 'pulse 1s infinite',
  },
  sectionBody: { padding: '4px 0 8px' },

  // 커밋 행
  commitRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 20px', borderBottom: '1px solid #191d28',
    transition: 'background .1s',
  },
  commitTag: {
    fontSize: 10, color: '#7a9aba', fontFamily: 'monospace',
    padding: '2px 6px', borderRadius: 3, flexShrink: 0,
  },
  commitMsg: {
    flex: 1, fontSize: 12, color: '#9aabbd',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  commitDate: { fontSize: 10, color: '#3a4a5a', flexShrink: 0 },

  // 이슈 행
  issueRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 20px', borderBottom: '1px solid #191d28',
  },
  issueProvider: {
    fontSize: 9, color: '#5a6a7a', background: '#1a2030',
    padding: '1px 5px', borderRadius: 3, flexShrink: 0,
  },
  issueId: {
    fontSize: 10, color: '#7a9aba', fontFamily: 'monospace',
    flexShrink: 0, minWidth: 60,
  },
  issueTitle: {
    flex: 1, fontSize: 12, color: '#9aabbd',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  issueBadge: {
    fontSize: 9, color: '#aac', padding: '2px 7px',
    borderRadius: 10, flexShrink: 0,
  },

  // AI 요약
  loadWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0' },
  spinner: {
    width: 24, height: 24, border: '2px solid #252a38',
    borderTop: '2px solid #5a9eff', borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadMsg: { fontSize: 12, color: '#445', marginTop: 10 },
  resultWrap: { padding: '12px 20px' },
  resultActions: { display: 'flex', justifyContent: 'flex-end', marginBottom: 8 },
  copyBtn: {
    background: 'none', border: '1px solid #252a38', borderRadius: 4,
    color: '#556', fontSize: 11, padding: '3px 10px', cursor: 'pointer',
  },
  result: {
    fontSize: 13, lineHeight: 1.85, color: '#bbc8d8',
    whiteSpace: 'pre-wrap', fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif",
    margin: 0,
  },
  aiHint: {
    padding: '28px 20px', fontSize: 12, color: '#334', textAlign: 'center',
  },

  // 공통
  empty:   { padding: '14px 20px', fontSize: 12, color: '#334' },
  errText: { padding: '10px 20px', fontSize: 11, color: '#a04040' },
}
