import React from 'react'
import { useApp } from '../store/AppContext'

const SERVICES = [
  { key: 'git',    label: 'Git (로컬)',    alwaysOn: true },
  { key: 'svn',    label: 'SVN (사내)',    alwaysOn: false },
  { key: 'mantis', label: 'Mantis',        alwaysOn: false },
  { key: 'jira',   label: 'Jira',          alwaysOn: false },
]

export default function StatusPanel() {
  const { state, checkConnections } = useApp()

  return (
    <div style={styles.container}>
      {SERVICES.map(svc => {
        const conn = state.connections[svc.key]
        const enabled = svc.alwaysOn
          || state.config?.[svc.key]?.enabled
          || false

        return (
          <div key={svc.key} style={styles.row}>
            <div style={{
              ...styles.dot,
              background: !enabled
                ? '#3a3a3a'
                : conn.checking
                  ? '#aa8800'
                  : conn.ok
                    ? '#27ae60'
                    : '#c0392b',
            }} />
            <span style={styles.label}>{svc.label}</span>
            <span style={styles.status}>
              {!enabled
                ? '비활성'
                : conn.checking
                  ? '확인 중...'
                  : conn.ok
                    ? '연결됨'
                    : svc.alwaysOn ? '항상 연결' : '연결 안됨'}
            </span>
          </div>
        )
      })}

      <button
        style={styles.recheckBtn}
        onClick={() => checkConnections(state.config)}
      >
        다시 확인
      </button>
    </div>
  )
}

const styles = {
  container: { padding: 12, height: '100%', display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  label: { fontSize: 12, color: '#bbb', flex: 1 },
  status: { fontSize: 11, color: '#666' },
  recheckBtn: {
    marginTop: 'auto', padding: '6px 0', background: 'none',
    border: '1px solid #3a3a3a', borderRadius: 4,
    color: '#666', fontSize: 11, cursor: 'pointer',
  },
}
