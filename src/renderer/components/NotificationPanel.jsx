import React from 'react'
import { useApp } from '../store/AppContext'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ko'

dayjs.extend(relativeTime)
dayjs.locale('ko')

const TYPE_META = {
  jira_new:    { icon: '◈', label: '새 이슈',    color: '#4a9eff' },
  jira_status: { icon: '↔', label: '상태 변경',  color: '#f0a04a' },
  jira_comment:{ icon: '◎', label: '업데이트',   color: '#9a9aff' },
  schedule:    { icon: '▦', label: '일정',        color: '#4acf8a' },
  gmail:       { icon: '✉', label: 'Gmail',       color: '#ea4335' },
}

export default function NotificationPanel() {
  const { state, dispatch } = useApp()
  const { items } = state.notifications

  const handleClick = (notif) => {
    dispatch({ type: 'MARK_NOTIF_READ', payload: notif.id })
    if (notif.url) window.open(notif.url, '_blank')
  }

  const handleMarkAll = () => dispatch({ type: 'MARK_ALL_READ' })
  const handleClear   = () => dispatch({ type: 'CLEAR_NOTIFICATIONS' })

  return (
    <div style={s.wrap}>
      {/* 헤더 */}
      <div style={s.header}>
        <span style={s.headerTitle}>알림</span>
        <div style={s.headerBtns}>
          {items.some(n => !n.read) && (
            <button style={s.headerBtn} onClick={handleMarkAll}>모두 읽음</button>
          )}
          {items.length > 0 && (
            <button style={s.headerBtn} onClick={handleClear}>전체 삭제</button>
          )}
        </div>
      </div>

      {/* 목록 */}
      <div style={s.list}>
        {items.length === 0 ? (
          <div style={s.empty}>새로운 알림이 없습니다</div>
        ) : (
          items.map(notif => {
            const meta = TYPE_META[notif.type] || { icon: '●', label: '', color: '#888' }
            return (
              <div
                key={notif.id}
                style={{ ...s.item, ...(notif.read ? {} : s.itemUnread) }}
                onClick={() => handleClick(notif)}
              >
                {/* 읽지 않음 표시 */}
                {!notif.read && <span style={s.dot} />}

                {/* 타입 아이콘 */}
                <span style={{ ...s.typeIcon, color: meta.color }}>{meta.icon}</span>

                {/* 내용 */}
                <div style={s.content}>
                  <div style={s.itemTitle}>{notif.title}</div>
                  <div style={s.itemBody}>{notif.body}</div>
                  <div style={s.itemMeta}>
                    <span style={{ color: meta.color, fontSize: 9 }}>{meta.label}</span>
                    <span style={s.itemTime}>
                      {dayjs(notif.createdAt).fromNow()}
                    </span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', background: '#161616' },

  header: {
    display: 'flex', alignItems: 'center', padding: '10px 14px',
    borderBottom: '1px solid #2a2a2a', flexShrink: 0,
  },
  headerTitle: { fontSize: 13, fontWeight: 600, color: '#ccc' },
  headerBtns:  { marginLeft: 'auto', display: 'flex', gap: 6 },
  headerBtn: {
    background: 'none', border: '1px solid #3a3a3a', borderRadius: 4,
    color: '#666', fontSize: 10, padding: '3px 8px', cursor: 'pointer',
  },

  list: { flex: 1, overflowY: 'auto' },

  empty: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', color: '#444', fontSize: 12,
  },

  item: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    padding: '10px 14px', borderBottom: '1px solid #222',
    cursor: 'pointer', position: 'relative',
    transition: 'background .1s',
  },
  itemUnread: { background: '#1a1e28' },

  dot: {
    position: 'absolute', left: 5, top: '50%', transform: 'translateY(-50%)',
    width: 5, height: 5, borderRadius: '50%', background: '#4a9eff', flexShrink: 0,
  },

  typeIcon: { fontSize: 14, flexShrink: 0, marginTop: 1 },

  content: { flex: 1, minWidth: 0 },
  itemTitle: {
    fontSize: 12, fontWeight: 600, color: '#ccc',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    marginBottom: 2,
  },
  itemBody: {
    fontSize: 11, color: '#888',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    marginBottom: 4,
  },
  itemMeta: { display: 'flex', alignItems: 'center', gap: 6 },
  itemTime: { fontSize: 10, color: '#444', marginLeft: 'auto' },
}
