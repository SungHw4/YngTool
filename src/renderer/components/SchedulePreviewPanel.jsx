import React, { useState, useContext, useMemo } from 'react'
import { NavContext } from '../App'

const STORAGE_KEY = 'devdash-schedule-v1'
const DAY_NAMES   = ['일', '월', '화', '수', '목', '금', '토']
const COLORS      = ['#1a3d5c', '#1a3d1a', '#3d1a1a', '#2d1a3d', '#3d2d1a', '#1a3a3a']

function fmt(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function loadItems() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}

function matchesDate(item, dateStr) {
  if (!item.routine) return item.date === dateStr
  const { type, days, dayOfMonth, startDate, endDate } = item.routine
  if (startDate && dateStr < startDate) return false
  if (endDate   && dateStr > endDate)   return false
  const d = new Date(dateStr)
  if (type === 'daily')   return true
  if (type === 'weekly')  return (days || []).includes(d.getDay())
  if (type === 'monthly') return d.getDate() === (dayOfMonth || 1)
  return false
}

function sortByTime(items) {
  return [...items].sort((a, b) => {
    if (a.allDay && !b.allDay) return -1
    if (!a.allDay && b.allDay) return 1
    return (a.time || '').localeCompare(b.time || '')
  })
}

export default function SchedulePreviewPanel() {
  const { setActivePage } = useContext(NavContext) || {}
  const [view, setView]   = useState('today')   // 'today' | 'week'

  const allItems = loadItems()
  const today    = new Date()
  const todayStr = fmt(today)

  // 금주 날짜 배열 (월~일)
  const weekDays = useMemo(() => {
    const off = (today.getDay() + 6) % 7
    const mon = new Date(today)
    mon.setDate(today.getDate() - off)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon)
      d.setDate(mon.getDate() + i)
      return d
    })
  }, []) // eslint-disable-line

  // 오늘 일정
  const todayItems = useMemo(() =>
    sortByTime(allItems.filter(it => matchesDate(it, todayStr)))
  , [allItems, todayStr])

  // 금주 일정 (날짜 붙여서 flat)
  const weekItems = useMemo(() =>
    weekDays.flatMap(day => {
      const dateStr = fmt(day)
      return sortByTime(allItems.filter(it => matchesDate(it, dateStr)))
        .map(it => ({ ...it, _day: day, _dateStr: dateStr }))
    })
  , [allItems, weekDays])

  const displayItems = view === 'today' ? todayItems : weekItems

  return (
    <div style={s.wrap}>
      {/* 헤더 */}
      <div style={s.header}>
        <div style={s.toggle}>
          {[['today', '오늘'], ['week', '금주']].map(([v, label]) => (
            <button key={v}
              style={{ ...s.toggleBtn, ...(view === v ? s.toggleBtnActive : {}) }}
              onClick={() => setView(v)}
            >
              {label}
            </button>
          ))}
        </div>
        <button style={s.iconBtn} onClick={() => setActivePage?.('schedule')} title="일정표로 이동">
          ↗
        </button>
      </div>

      {/* 일정 목록 */}
      <div style={s.list}>
        {displayItems.length === 0 ? (
          <div style={s.empty}>
            {view === 'today' ? '금일 정해진 일정이 없습니다' : '금주 정해진 일정이 없습니다'}
          </div>
        ) : (
          displayItems.map((item, i) => (
            <div
              key={`${item.id ?? i}-${item._dateStr ?? ''}`}
              style={s.item}
              onClick={() => setActivePage?.('schedule')}
            >
              <div style={{ ...s.colorBar, background: COLORS[item.color] || COLORS[0] }} />
              <div style={s.itemBody}>
                {/* 금주 뷰: 날짜 표시 */}
                {view === 'week' && item._day && (
                  <div style={s.dateTag}>
                    {item._day.getMonth()+1}/{item._day.getDate()}
                    ({DAY_NAMES[item._day.getDay()]})
                  </div>
                )}
                <div style={s.itemTitle}>
                  {item.routine && <span style={s.routineIcon}>↻ </span>}
                  {item.title}
                </div>
                {!item.allDay && item.time && (
                  <div style={s.itemTime}>{item.time}</div>
                )}
                {item.note && (
                  <div style={s.itemNote}>{item.note}</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 하단 바로가기 */}
      <div style={s.footer}>
        <button style={s.moreBtn} onClick={() => setActivePage?.('schedule')}>
          일정표 전체 보기 →
        </button>
      </div>
    </div>
  )
}

// ─── 스타일 ───────────────────────────────────────────────────────
const s = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', background: '#1c2030', overflow: 'hidden' },

  header: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 12px', borderBottom: '1px solid #252a38', flexShrink: 0,
  },
  toggle: { display: 'flex', borderRadius: 5, overflow: 'hidden', border: '1px solid #252a38' },
  toggleBtn: {
    background: 'none', border: 'none', color: '#556',
    fontSize: 11, padding: '3px 12px', cursor: 'pointer',
  },
  toggleBtnActive: { background: '#1a2438', color: '#8ab' },
  iconBtn: {
    marginLeft: 'auto', background: 'none', border: 'none',
    color: '#556', fontSize: 14, cursor: 'pointer', padding: '2px 6px',
  },

  list: { flex: 1, overflowY: 'auto' },

  empty: {
    padding: '24px 16px', fontSize: 12, color: '#445', textAlign: 'center',
  },

  item: {
    display: 'flex', gap: 0, borderBottom: '1px solid #1e2130',
    cursor: 'pointer', transition: 'background .1s',
  },
  colorBar: { width: 3, flexShrink: 0 },
  itemBody: { flex: 1, padding: '8px 12px', minWidth: 0 },

  dateTag: { fontSize: 10, color: '#6a7a8a', marginBottom: 3 },

  itemTitle: {
    fontSize: 12, color: '#c0cce0', fontWeight: 500,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  routineIcon: { color: '#6a8aaa', fontSize: 10 },
  itemTime:    { fontSize: 10, color: '#6a8aaa', marginTop: 2 },
  itemNote: {
    fontSize: 10, color: '#445', marginTop: 2,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },

  footer: { flexShrink: 0, padding: '6px 12px', borderTop: '1px solid #1e2130' },
  moreBtn: {
    background: 'none', border: 'none', color: '#4a7aaa',
    fontSize: 11, cursor: 'pointer', padding: 0,
  },
}
