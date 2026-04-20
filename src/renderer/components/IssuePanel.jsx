import React from 'react'
import { useApp } from '../store/AppContext'
import dayjs from 'dayjs'

const PRIORITY_COLOR = {
  urgent: '#c0392b', high: '#e67e22', normal: '#2980b9', low: '#27ae60',
  blocker: '#c0392b', critical: '#e67e22', major: '#2980b9', minor: '#27ae60',
}

const TYPE_COLOR = {
  bug: { bg: '#3d1a1a', text: '#e07070' },
  feature: { bg: '#1a2d3d', text: '#70a8e0' },
  task: { bg: '#1a3d1a', text: '#70d070' },
  improvement: { bg: '#2d2d1a', text: '#d0c070' },
  story: { bg: '#1a3d1a', text: '#70d070' },
  epic: { bg: '#2d1a3d', text: '#a070d0' },
  default: { bg: '#2a2a2a', text: '#999' },
}

function typeBadge(type) {
  const t = type?.toLowerCase() || 'default'
  const color = TYPE_COLOR[t] || TYPE_COLOR.default
  return (
    <span style={{
      fontSize: 10, padding: '2px 6px', borderRadius: 3,
      background: color.bg, color: color.text,
      textTransform: 'uppercase', fontWeight: 600,
    }}>
      {type || '기타'}
    </span>
  )
}

export default function IssuePanel() {
  const { state } = useApp()
  const { items, loading, error } = state.issues
  const { mantis, jira } = state.connections

  const noProviderEnabled = !state.config?.mantis?.enabled && !state.config?.jira?.enabled
  const noConnection = !mantis.ok && !jira.ok

  if (noProviderEnabled) {
    return <Empty msg="설정에서 Mantis 또는 Jira를 활성화해주세요" />
  }
  if (noConnection) {
    return <Empty msg="이슈 트래커에 연결할 수 없습니다 (사내망 확인)" muted />
  }
  if (loading) {
    return <Empty msg="이슈 불러오는 중..." />
  }
  if (error) {
    return <Empty msg={`오류: ${error}`} danger />
  }
  if (items.length === 0) {
    return <Empty msg="할당된 이슈가 없습니다" />
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      {items.map(issue => (
        <div
          key={`${issue.provider}-${issue.id}`}
          style={styles.row}
          onClick={() => window.open(issue.url)}
          title="클릭하여 열기"
        >
          <div style={styles.top}>
            <span style={styles.id}>{issue.id}</span>
            {typeBadge(issue.type)}
            <span style={styles.title}>{issue.title}</span>
          </div>
          <div style={styles.bottom}>
            <span style={{ ...styles.dot, background: PRIORITY_COLOR[issue.priority?.toLowerCase()] || '#555' }} />
            <span style={styles.meta}>{issue.priority}</span>
            <span style={styles.meta}>·</span>
            <span style={styles.meta}>{issue.status}</span>
            <span style={{ ...styles.meta, marginLeft: 'auto' }}>{dayjs(issue.updated).fromNow()}</span>
            <span style={{ ...styles.provBadge, opacity: .5 }}>{issue.provider}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function Empty({ msg, muted, danger }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <p style={{ fontSize: 13, color: danger ? '#c0392b' : muted ? '#555' : '#666' }}>{msg}</p>
    </div>
  )
}

const styles = {
  row: {
    padding: '8px 12px', borderBottom: '1px solid #2a2a2a',
    cursor: 'pointer', transition: '.1s',
  },
  top: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 },
  bottom: { display: 'flex', alignItems: 'center', gap: 4 },
  id: { fontSize: 10, color: '#555', fontFamily: 'monospace', minWidth: 40 },
  title: { flex: 1, fontSize: 12, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  dot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  meta: { fontSize: 11, color: '#555' },
  provBadge: { fontSize: 10, color: '#444', marginLeft: 4 },
}
