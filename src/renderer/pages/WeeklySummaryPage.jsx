import React, { useState, useCallback } from 'react'
import { useApp } from '../store/AppContext'

const STORAGE_KEY = 'devdash-schedule-v1'

function loadSchedule() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function getWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7))
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  return { start: fmt(mon), end: fmt(sun) }
}

function buildPrompt({ commits, issues, schedule }) {
  const { start, end } = getWeekRange()
  const svnItems = Object.values(commits.svn).flatMap(r => r.items || [])
  const gitItems = Object.values(commits.git).flatMap(r => r.items || [])
  const weekCommits = [...svnItems, ...gitItems]
    .filter(c => c.date && c.date >= start && c.date <= end)
    .map(c => `- [${c.type === 'svn' ? `r${c.revision}` : c.hash}] ${c.message}`)
    .join('\n') || '(이번 주 커밋 없음)'

  const issueList = issues.items.map(i => `- [${i.provider}] ${i.id}: ${i.title} (${i.status})`).join('\n') || '(이슈 없음)'

  const scheduleList = loadSchedule()
    .filter(s => s.date >= start && s.date <= end)
    .map(s => `- ${s.date} ${s.allDay ? '(종일)' : s.time} ${s.title}`)
    .join('\n') || '(일정 없음)'

  return `당신은 개발자의 주간 업무를 정리해주는 어시스턴트입니다.
아래 이번 주(${start} ~ ${end}) 데이터를 바탕으로 한국어 주간 업무 보고를 작성해주세요.

[이번 주 커밋 로그]
${weekCommits}

[현재 할당 이슈]
${issueList}

[이번 주 일정]
${scheduleList}

작성 형식:
1. **이번 주 완료 작업** — 커밋 기반으로 간결하게
2. **진행 중 / 이슈** — 현재 할당된 이슈 상태
3. **다음 주 예정** — 이슈와 일정 기반
4. **한 줄 요약** — 전체 주간을 한 문장으로

간결하고 실무적으로 작성해주세요.`
}

export default function WeeklySummaryPage() {
  const { state } = useApp()
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [copied, setCopied]   = useState(false)
  const { start, end }        = getWeekRange()

  const generate = useCallback(async () => {
    const apiKey = state.config?.ai?.anthropicKey
    if (!apiKey) { setError('설정에서 Anthropic API 키를 입력해주세요.'); return }

    setLoading(true); setError(''); setSummary('')

    try {
      const prompt = buildPrompt({ commits: state.commits, issues: state.issues, schedule: null })
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
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [state])

  const copy = () => {
    navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <div style={s.title}>주간 요약</div>
          <div style={s.sub}>{start} ~ {end}</div>
        </div>
        <button style={s.genBtn} onClick={generate} disabled={loading}>
          {loading ? '생성 중...' : 'AI 요약 생성'}
        </button>
      </div>

      <div style={s.body}>
        {loading && (
          <div style={s.loadWrap}>
            <div style={s.spinner} />
            <p style={s.loadMsg}>이번 주 커밋, 이슈, 일정을 분석하는 중...</p>
          </div>
        )}

        {error && <div style={s.err}>{error}</div>}

        {summary && (
          <div style={s.resultWrap}>
            <div style={s.resultActions}>
              <button style={s.copyBtn} onClick={copy}>{copied ? '✓ 복사됨' : '클립보드 복사'}</button>
            </div>
            <pre style={s.result}>{summary}</pre>
          </div>
        )}

        {!loading && !summary && !error && (
          <div style={s.empty}>
            <p>버튼을 눌러 이번 주 업무를 AI로 요약합니다</p>
            <p style={s.emptyHint}>커밋 로그, 이슈, 일정표 데이터를 자동으로 수집합니다</p>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  page: { height: '100%', display: 'flex', flexDirection: 'column', background: '#161616' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', borderBottom: '1px solid #2a2a2a', flexShrink: 0,
  },
  title: { fontSize: 14, color: '#ccc', fontWeight: 500 },
  sub:   { fontSize: 11, color: '#555', marginTop: 2 },
  genBtn: {
    background: '#1a3050', border: '1px solid #2a6090', borderRadius: 6,
    color: '#7ac', fontSize: 13, padding: '7px 16px', cursor: 'pointer',
  },
  body: { flex: 1, overflowY: 'auto', padding: 16 },
  loadWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 40 },
  spinner: {
    width: 26, height: 26, border: '2px solid #333',
    borderTop: '2px solid #66aaff', borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadMsg: { fontSize: 12, color: '#555', marginTop: 12 },
  err: { color: '#e07070', fontSize: 13, padding: 12 },
  resultWrap: { position: 'relative' },
  resultActions: { display: 'flex', justifyContent: 'flex-end', marginBottom: 8 },
  copyBtn: {
    background: 'none', border: '1px solid #3a3a3a', borderRadius: 4,
    color: '#666', fontSize: 11, padding: '3px 10px', cursor: 'pointer',
  },
  result: {
    fontSize: 13, lineHeight: 1.8, color: '#ccc',
    whiteSpace: 'pre-wrap', fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif",
  },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80%', gap: 8 },
  emptyHint: { fontSize: 12, color: '#444' },
}
