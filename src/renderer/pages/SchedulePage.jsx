import React, { useState, useEffect } from 'react'

const STORAGE_KEY = 'devdash-schedule-v1'
const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const COLORS = ['#1a3d5c', '#1a3d1a', '#3d1a1a', '#2d1a3d', '#3d2d1a']

function loadSchedule() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}
function saveSchedule(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function getWeekDays(baseDate) {
  const d = new Date(baseDate)
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((day + 6) % 7))   // 월요일 기준
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday)
    dd.setDate(monday.getDate() + i)
    return dd
  })
}

function fmt(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

export default function SchedulePage() {
  const [baseDate, setBaseDate] = useState(new Date())
  const [items, setItems]       = useState(loadSchedule)
  const [modal, setModal]       = useState(null)   // { date } | { item, idx } | null
  const [form, setForm]         = useState({ title: '', color: 0, allDay: true, time: '09:00', note: '' })

  const weekDays = getWeekDays(baseDate)
  const today = fmt(new Date())

  const save = (newItems) => { setItems(newItems); saveSchedule(newItems) }

  const openNew = (date) => {
    setForm({ title: '', color: 0, allDay: true, time: '09:00', note: '' })
    setModal({ date: fmt(date) })
  }
  const openEdit = (item, idx) => {
    setForm({ ...item })
    setModal({ item, idx })
  }

  const handleSubmit = () => {
    if (!form.title.trim()) return
    if (modal.idx !== undefined) {
      // 수정
      const next = [...items]
      next[modal.idx] = { ...form, date: items[modal.idx].date }
      save(next)
    } else {
      // 신규
      save([...items, { ...form, date: modal.date, id: Date.now() }])
    }
    setModal(null)
  }

  const handleDelete = (idx) => {
    save(items.filter((_, i) => i !== idx))
    setModal(null)
  }

  const prevWeek = () => { const d = new Date(baseDate); d.setDate(d.getDate() - 7); setBaseDate(d) }
  const nextWeek = () => { const d = new Date(baseDate); d.setDate(d.getDate() + 7); setBaseDate(d) }
  const goToday  = () => setBaseDate(new Date())

  return (
    <div style={s.page}>
      {/* 헤더 */}
      <div style={s.header}>
        <button style={s.navBtn} onClick={prevWeek}>‹</button>
        <span style={s.weekLabel}>
          {weekDays[0].getMonth()+1}월 {weekDays[0].getDate()}일
          {' ~ '}
          {weekDays[6].getMonth()+1}월 {weekDays[6].getDate()}일
        </span>
        <button style={s.navBtn} onClick={nextWeek}>›</button>
        <button style={s.todayBtn} onClick={goToday}>오늘</button>
      </div>

      {/* 주간 그리드 */}
      <div style={s.grid}>
        {weekDays.map((day, di) => {
          const dateStr = fmt(day)
          const dayItems = items.filter(it => it.date === dateStr)
            .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
          const isToday = dateStr === today
          const isSun = di === 0
          const isSat = di === 6

          return (
            <div
              key={dateStr}
              style={{ ...s.dayCol, ...(isToday ? s.dayColToday : {}) }}
              onClick={() => openNew(day)}
            >
              <div style={s.dayHeader}>
                <span style={{
                  ...s.dayNum,
                  color: isToday ? '#7ac' : isSun ? '#c07070' : isSat ? '#7090c0' : '#888',
                }}>
                  {day.getDate()}
                </span>
                <span style={s.dayName}>{DAYS[di]}</span>
              </div>
              <div style={s.dayBody}>
                {dayItems.map((item, ii) => (
                  <div
                    key={item.id || ii}
                    style={{ ...s.chip, background: COLORS[item.color] || COLORS[0] }}
                    onClick={(e) => { e.stopPropagation(); openEdit(item, items.indexOf(item)) }}
                  >
                    {!item.allDay && <span style={s.chipTime}>{item.time}</span>}
                    <span style={s.chipTitle}>{item.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* 모달 */}
      {modal && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>
              {modal.idx !== undefined ? '일정 수정' : `일정 추가 — ${modal.date}`}
            </div>

            <input
              style={s.input} placeholder="제목"
              value={form.title} autoFocus
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />

            <div style={s.row}>
              <label style={s.chkLabel}>
                <input type="checkbox" checked={form.allDay}
                  onChange={e => setForm(f => ({ ...f, allDay: e.target.checked }))} />
                종일
              </label>
              {!form.allDay && (
                <input type="time" style={{ ...s.input, width: 100 }}
                  value={form.time}
                  onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              )}
            </div>

            <div style={s.colorRow}>
              {COLORS.map((c, i) => (
                <div
                  key={i} style={{ ...s.colorDot, background: c,
                    outline: form.color === i ? '2px solid #aaa' : 'none' }}
                  onClick={() => setForm(f => ({ ...f, color: i }))}
                />
              ))}
            </div>

            <input style={s.input} placeholder="메모 (선택)"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />

            <div style={s.btnRow}>
              {modal.idx !== undefined && (
                <button style={s.delBtn} onClick={() => handleDelete(modal.idx)}>삭제</button>
              )}
              <button style={s.cancelBtn} onClick={() => setModal(null)}>취소</button>
              <button style={s.saveBtn} onClick={handleSubmit}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page: { height: '100%', display: 'flex', flexDirection: 'column', background: '#161616' },
  header: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
    borderBottom: '1px solid #2a2a2a', flexShrink: 0,
  },
  navBtn: { background: 'none', border: 'none', color: '#666', fontSize: 18, cursor: 'pointer', padding: '0 4px' },
  weekLabel: { fontSize: 13, color: '#aaa', minWidth: 160 },
  todayBtn: {
    marginLeft: 'auto', background: 'none', border: '1px solid #3a3a3a',
    borderRadius: 4, color: '#666', fontSize: 11, padding: '3px 10px', cursor: 'pointer',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1, overflow: 'hidden' },
  dayCol: {
    borderRight: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column',
    cursor: 'pointer', minHeight: 0,
  },
  dayColToday: { background: '#1a2030' },
  dayHeader: {
    padding: '6px 8px 4px', display: 'flex', alignItems: 'baseline', gap: 4,
    borderBottom: '1px solid #2a2a2a', flexShrink: 0,
  },
  dayNum: { fontSize: 16, fontWeight: 500 },
  dayName: { fontSize: 10, color: '#444' },
  dayBody: { flex: 1, overflowY: 'auto', padding: '4px 4px', display: 'flex', flexDirection: 'column', gap: 2 },
  chip: {
    borderRadius: 3, padding: '2px 5px', cursor: 'pointer',
    display: 'flex', gap: 4, alignItems: 'center',
  },
  chipTime: { fontSize: 9, color: '#aaa', flexShrink: 0 },
  chipTitle: { fontSize: 11, color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modalBox: {
    width: 320, background: '#1e1e1e', border: '1px solid #3a3a3a',
    borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 8,
  },
  modalTitle: { fontSize: 13, color: '#aaa', marginBottom: 4 },
  input: {
    background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: 4,
    padding: '6px 8px', color: '#ccc', fontSize: 12, outline: 'none', width: '100%',
  },
  row: { display: 'flex', alignItems: 'center', gap: 10 },
  chkLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#999', cursor: 'pointer' },
  colorRow: { display: 'flex', gap: 6 },
  colorDot: { width: 16, height: 16, borderRadius: '50%', cursor: 'pointer' },
  btnRow: { display: 'flex', gap: 6, marginTop: 4 },
  delBtn: { background: 'none', border: '1px solid #5a2a2a', borderRadius: 4, color: '#c07070', fontSize: 12, padding: '5px 10px', cursor: 'pointer' },
  cancelBtn: { background: 'none', border: '1px solid #3a3a3a', borderRadius: 4, color: '#666', fontSize: 12, padding: '5px 10px', cursor: 'pointer', marginLeft: 'auto' },
  saveBtn: { background: '#1a3050', border: '1px solid #2a6090', borderRadius: 4, color: '#7ac', fontSize: 12, padding: '5px 14px', cursor: 'pointer' },
}
