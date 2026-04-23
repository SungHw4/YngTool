import React, { useContext, useMemo } from 'react'
import { useApp } from '../store/AppContext'
import { NavContext } from '../App'

// ─── 금주 날짜 범위 계산 ──────────────────────────────────────────
function getWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7))
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  return { start: fmt(mon), end: fmt(sun) }
}

// ─── 날짜 포맷: MM/DD ─────────────────────────────────────────────
function fmtDate(dateStr = '') {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr.slice(5, 10) || ''
  return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
}

// ─── 커밋 메시지 한 줄 정리 ───────────────────────────────────────
function shortMsg(msg = '') {
  return msg.split('\n')[0].slice(0, 52)
}

export default function WeeklySummaryPreviewPanel() {
  const { state } = useApp()
  const { setActivePage } = useContext(NavContext) || {}
  const { start, end } = getWeekRange()

  // 금주 SVN 커밋
  const svnCommits = useMemo(() => {
    return Object.values(state.commits.svn).flatMap(r => r.items || [])
      .filter(c => c.date && c.date >= start && c.date <= end)
  }, [state.commits.svn, start, end])

  // 금주 Git 커밋
  const gitCommits = useMemo(() => {
    return Object.values(state.commits.git).flatMap(r => r.items || [])
      .filter(c => c.date && c.date >= start && c.date <= end)
  }, [state.commits.git, start, end])

  // 금주 전체 커밋 (최신순 상위 5개)
  const recentCommits = useMemo(() => {
    return [...svnCommits, ...gitCommits]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 5)
  }, [svnCommits, gitCommits])

  const totalCommits = svnCommits.length + gitCommits.length
  const issueCount   = state.issues.items.length

  const goToSummary = () => setActivePage?.('summary')

  return (
    <div style={s.wrap}>
      {/* 헤더 */}
      <div style={s.header}>
        <span style={s.headerTitle}>☰ 주간 요약</span>
        <span style={s.weekRange}>{start.slice(5)} ~ {end.slice(5)}</span>
        <button style={s.iconBtn} onClick={goToSummary} title="주간 요약 탭으로">↗</button>
      </div>

      {/* 통계 카드 */}
      <div style={s.stats}>
        <div style={s.statCard}>
          <div style={s.statValue}>{totalCommits}</div>
          <div style={s.statLabel}>금주 커밋</div>
          {(svnCommits.length > 0 || gitCommits.length > 0) && (
            <div style={s.statSub}>
              {svnCommits.length > 0 && <span>SVN {svnCommits.length}</span>}
              {svnCommits.length > 0 && gitCommits.length > 0 && <span style={s.sep}>·</span>}
              {gitCommits.length > 0 && <span>Git {gitCommits.length}</span>}
            </div>
          )}
        </div>
        <div style={s.statDivider} />
        <div style={s.statCard}>
          <div style={s.statValue}>{issueCount}</div>
          <div style={s.statLabel}>담당 이슈</div>
          {state.issues.loading && <div style={s.statSub}>로딩 중...</div>}
        </div>
      </div>

      {/* 최근 커밋 목록 */}
      <div style={s.sectionLabel}>최근 커밋</div>
      <div style={s.list}>
        {recentCommits.length === 0 ? (
          <div style={s.empty}>금주 커밋이 없습니다</div>
        ) : (
          recentCommits.map((c, i) => (
            <div key={`${c.hash || c.revision}-${i}`} style={s.commitItem}>
              <span style={{ ...s.commitTag, background: c.type === 'svn' ? '#1a3030' : '#1a2040' }}>
                {c.type === 'svn' ? `r${c.revision}` : (c.hash || '').slice(0, 6)}
              </span>
              <span style={s.commitMsg}>{shortMsg(c.message)}</span>
              <span style={s.commitDate}>{fmtDate(c.date)}</span>
            </div>
          ))
        )}
      </div>

      {/* 하단 바로가기 */}
      <div style={s.footer}>
        <button style={s.moreBtn} onClick={goToSummary}>
          주간 요약 전체 보기 →
        </button>
      </div>
    </div>
  )
}

// ─── 스타일 ───────────────────────────────────────────────────────
const s = {
  wrap: {
    display: 'flex', flexDirection: 'column', height: '100%',
    background: '#1c2030', overflow: 'hidden',
  },

  header: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 12px', borderBottom: '1px solid #252a38', flexShrink: 0,
  },
  headerTitle: { fontSize: 12, fontWeight: 600, color: '#c0cce0' },
  weekRange:   { fontSize: 10, color: '#445', marginLeft: 4, flex: 1 },
  iconBtn: {
    background: 'none', border: 'none', color: '#556', fontSize: 14,
    cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
  },

  stats: {
    display: 'flex', alignItems: 'center',
    padding: '10px 12px', gap: 0, flexShrink: 0,
    borderBottom: '1px solid #1e2130',
  },
  statCard: { flex: 1, textAlign: 'center' },
  statValue: { fontSize: 22, fontWeight: 700, color: '#8ab4d8', lineHeight: 1.1 },
  statLabel: { fontSize: 10, color: '#556', marginTop: 2 },
  statSub:   { fontSize: 9,  color: '#3a4a5a', marginTop: 3, display: 'flex', justifyContent: 'center', gap: 4 },
  sep:       { color: '#2a3a4a' },
  statDivider: { width: 1, height: 36, background: '#252a38', flexShrink: 0, margin: '0 4px' },

  sectionLabel: {
    fontSize: 9, color: '#334', letterSpacing: '.07em',
    textTransform: 'uppercase', padding: '7px 12px 3px', flexShrink: 0,
  },

  list: { flex: 1, overflowY: 'auto' },

  empty: {
    padding: '16px 12px', fontSize: 12, color: '#445', textAlign: 'center',
  },

  commitItem: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderBottom: '1px solid #1a1e2a',
  },
  commitTag: {
    fontSize: 9, color: '#6a8aaa', fontFamily: 'monospace',
    padding: '1px 5px', borderRadius: 3, flexShrink: 0,
  },
  commitMsg: {
    flex: 1, fontSize: 11, color: '#9aabbd',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  commitDate: { fontSize: 9, color: '#3a4a5a', flexShrink: 0 },

  footer: { flexShrink: 0, padding: '6px 12px', borderTop: '1px solid #1e2130' },
  moreBtn: {
    background: 'none', border: 'none', color: '#4a7aaa',
    fontSize: 11, cursor: 'pointer', padding: 0,
  },
}
