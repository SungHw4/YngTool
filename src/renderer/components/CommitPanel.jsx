import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ko'

dayjs.extend(relativeTime)
dayjs.locale('ko')

export default function CommitPanel() {
  const { state, dispatch } = useApp()
  const [contextMenu, setContextMenu] = useState(null)  // { x, y, commit }

  // 모든 SVN + Git 커밋을 합쳐서 날짜 내림차순 정렬
  const allCommits = []
  Object.entries(state.commits.svn).forEach(([repoPath, data]) => {
    if (data.items) allCommits.push(...data.items.map(c => ({ ...c, repoPath })))
  })
  Object.entries(state.commits.git).forEach(([repoPath, data]) => {
    if (data.items) allCommits.push(...data.items.map(c => ({ ...c, repoPath })))
  })
  allCommits.sort((a, b) => new Date(b.date) - new Date(a.date))

  const handleContextMenu = (e, commit) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, commit })
  }

  const handleOpenReview = (commit) => {
    setContextMenu(null)
    dispatch({
      type: 'OPEN_CODE_REVIEW',
      payload: {
        type: commit.type,
        id: commit.type === 'svn' ? commit.revision : commit.hash,
        repoPath: commit.repoPath,
        message: commit.message,
      },
    })
  }

  const dismissMenu = () => setContextMenu(null)

  if (allCommits.length === 0) {
    return (
      <div style={styles.empty}>
        <p>저장소 경로를 설정에서 추가해주세요</p>
      </div>
    )
  }

  return (
    <div style={styles.container} onClick={dismissMenu}>
      <div style={styles.list}>
        {allCommits.map((commit, i) => (
          <div
            key={`${commit.type}-${commit.revision || commit.hash}-${i}`}
            style={styles.row}
            onContextMenu={(e) => handleContextMenu(e, commit)}
          >
            <span style={{ ...styles.badge, background: commit.type === 'svn' ? '#1a3a5c' : '#1a3d2b' }}>
              {commit.type === 'svn' ? `r${commit.revision}` : commit.hash}
            </span>
            <span style={styles.msg}>{commit.message}</span>
            <span style={styles.author}>{commit.author}</span>
            <span style={styles.time}>{dayjs(commit.date).fromNow()}</span>
          </div>
        ))}
      </div>

      {contextMenu && (
        <div
          style={{ ...styles.ctxMenu, left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={styles.ctxItem} onClick={() => handleOpenReview(contextMenu.commit)}>
            AI 코드 리뷰
          </div>
          <div style={styles.ctxSep} />
          <div style={styles.ctxItem} onClick={dismissMenu}>
            닫기
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: { position: 'relative', height: '100%', overflow: 'hidden' },
  list: { height: '100%', overflowY: 'auto' },
  empty: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666', fontSize: 13 },
  row: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 12px', borderBottom: '1px solid #2a2a2a',
    cursor: 'default', userSelect: 'none',
  },
  badge: {
    fontSize: 10, padding: '2px 5px', borderRadius: 3,
    color: '#aac', fontFamily: 'monospace', minWidth: 54,
  },
  msg: { flex: 1, fontSize: 12, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  author: { fontSize: 11, color: '#666', minWidth: 60, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' },
  time: { fontSize: 11, color: '#555', minWidth: 52, textAlign: 'right' },
  ctxMenu: {
    position: 'fixed', zIndex: 9999, background: '#2a2a2a',
    border: '1px solid #444', borderRadius: 6, padding: '4px 0',
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)', minWidth: 140,
  },
  ctxItem: {
    padding: '8px 16px', fontSize: 13, color: '#ddd',
    cursor: 'pointer', transition: '.1s',
  },
  ctxSep: { height: 1, background: '#3a3a3a', margin: '2px 0' },
}
