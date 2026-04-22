import React, { useState } from 'react'

const STORAGE_KEY = 'devdash-schedule-v1'

const DAY_NAMES       = ['일', '월', '화', '수', '목', '금', '토']
const DAY_NAMES_GRID  = ['월', '화', '수', '목', '금', '토', '일']  // 월요일 시작

const COLORS = [
  '#1a3d5c', '#1a3d1a', '#3d1a1a',
  '#2d1a3d', '#3d2d1a', '#1a3a3a',
]

// ─── 유틸 ────────────────────────────────────────────────────────
function fmt(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function loadItems() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}
function saveItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

// item이 dateStr 날짜에 해당하는지 체크 (루틴 포함)
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

function getItemsForDate(items, dateStr) {
  return items
    .filter(it => matchesDate(it, dateStr))
    .sort((a, b) => {
      if (a.allDay && !b.allDay) return -1
      if (!a.allDay && b.allDay) return 1
      return (a.time || '').localeCompare(b.time || '')
    })
}

// 주간: 해당 주 7일 (월~일)
function getWeekDays(base) {
  const d   = new Date(base)
  const off = (d.getDay() + 6) % 7
  const mon = new Date(d)
  mon.setDate(d.getDate() - off)
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(mon)
    dd.setDate(mon.getDate() + i)
    return dd
  })
}

// 월간: 6×7 그리드 (월요일 시작)
function getMonthGrid(year, month) {
  const first = new Date(year, month, 1)
  const off   = (first.getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(year, month, 1 - off + i)
    return d
  })
}

// ─── ItemChip ────────────────────────────────────────────────────
function ItemChip({ item, onClick, compact = false }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: COLORS[item.color] || COLORS[0],
        borderRadius: 3,
        padding: compact ? '1px 5px' : '3px 6px',
        display: 'flex', alignItems: 'center', gap: 3,
        cursor: 'pointer', overflow: 'hidden',
      }}
    >
      {item.routine && (
        <span style={{ fontSize: 8, color: '#aaa', flexShrink: 0 }}>↻</span>
      )}
      {!item.allDay && (
        <span style={{ fontSize: 9, color: '#aaa', flexShrink: 0 }}>{item.time}</span>
      )}
      <span style={{
        fontSize: compact ? 10 : 11, color: '#ddd',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {item.title}
      </span>
    </div>
  )
}

// ─── WeekView ────────────────────────────────────────────────────
function WeekView({ baseDate, items, today, onDayClick, onItemClick }) {
  const weekDays = getWeekDays(baseDate)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1, overflow: 'hidden' }}>
      {weekDays.map((day, di) => {
        const dateStr  = fmt(day)
        const dayItems = getItemsForDate(items, dateStr)
        const isToday  = dateStr === today
        const dow      = day.getDay()
        const color    = isToday ? '#7ac' : dow === 0 ? '#c07070' : dow === 6 ? '#7090c0' : '#888'

        return (
          <div
            key={dateStr}
            onClick={() => onDayClick(dateStr)}
            style={{
              borderRight: '1px solid #1e2130', display: 'flex', flexDirection: 'column',
              cursor: 'pointer', minHeight: 0,
              background: isToday ? '#161c2a' : 'transparent',
            }}
          >
            <div style={{
              padding: '7px 8px 5px', borderBottom: '1px solid #1e2130',
              display: 'flex', alignItems: 'baseline', gap: 5, flexShrink: 0,
            }}>
              <span style={{ fontSize: 16, fontWeight: 500, color }}>{day.getDate()}</span>
              <span style={{ fontSize: 10, color: '#445' }}>{DAY_NAMES_GRID[di]}</span>
            </div>
            <div style={{
              flex: 1, overflowY: 'auto', padding: 4,
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              {dayItems.map((item, ii) => (
                <ItemChip
                  key={item.id ?? ii}
                  item={item}
                  onClick={(e) => { e.stopPropagation(); onItemClick(items.indexOf(item)) }}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── MonthView ───────────────────────────────────────────────────
function MonthView({ baseDate, items, today, onDayClick, onItemClick }) {
  const year  = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const grid  = getMonthGrid(year, month)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* 요일 헤더 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flexShrink: 0 }}>
        {DAY_NAMES_GRID.map((d, i) => (
          <div key={d} style={{
            padding: '5px 0', textAlign: 'center',
            fontSize: 10, color: i === 5 ? '#7090c0' : i === 6 ? '#c07070' : '#445',
            borderBottom: '1px solid #1e2130',
          }}>
            {d}
          </div>
        ))}
      </div>
      {/* 날짜 그리드 */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gridTemplateRows: 'repeat(6, 1fr)', flex: 1, overflow: 'hidden',
      }}>
        {grid.map((day, i) => {
          const dateStr        = fmt(day)
          const isCurrentMonth = day.getMonth() === month
          const isToday        = dateStr === today
          const dow            = day.getDay()
          const dayItems       = getItemsForDate(items, dateStr)
          const numColor       = isToday ? '#7ac' : dow === 0 ? '#c07070' : dow === 6 ? '#7090c0' : '#778'

          return (
            <div
              key={i}
              onClick={() => onDayClick(dateStr)}
              style={{
                borderRight: '1px solid #1a1e2a', borderBottom: '1px solid #1a1e2a',
                display: 'flex', flexDirection: 'column',
                cursor: 'pointer', overflow: 'hidden', minHeight: 0,
                background: isToday ? '#161c2a' : 'transparent',
                opacity: isCurrentMonth ? 1 : 0.3,
              }}
            >
              <div style={{ padding: '3px 5px', flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: numColor }}>
                  {day.getDate()}
                </span>
              </div>
              <div style={{
                flex: 1, overflow: 'hidden', padding: '0 3px 3px',
                display: 'flex', flexDirection: 'column', gap: 1,
              }}>
                {dayItems.slice(0, 3).map((item, ii) => (
                  <ItemChip
                    key={item.id ?? ii}
                    item={item}
                    compact
                    onClick={(e) => { e.stopPropagation(); onItemClick(items.indexOf(item)) }}
                  />
                ))}
                {dayItems.length > 3 && (
                  <div style={{ fontSize: 9, color: '#445', paddingLeft: 4 }}>
                    +{dayItems.length - 3}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── ScheduleModal ───────────────────────────────────────────────
function ScheduleModal({ form, setF, isEdit, dateLabel, onSave, onDelete, onClose }) {
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modalBox} onClick={e => e.stopPropagation()}>

        <div style={s.modalTitle}>
          {isEdit
            ? (form.isRoutine ? '루틴 수정' : `${dateLabel} 수정`)
            : `일정 추가 — ${dateLabel}`}
        </div>

        {/* 제목 */}
        <input
          style={s.input} placeholder="제목" value={form.title} autoFocus
          onChange={e => setF('title', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSave()}
        />

        {/* 종일/시간 */}
        <div style={s.row}>
          <label style={s.chkLabel}>
            <input type="checkbox" checked={form.allDay}
              onChange={e => setF('allDay', e.target.checked)} />
            종일
          </label>
          {!form.allDay && (
            <input type="time" style={{ ...s.input, width: 110 }}
              value={form.time} onChange={e => setF('time', e.target.value)} />
          )}
        </div>

        {/* 색상 */}
        <div style={s.colorRow}>
          {COLORS.map((c, i) => (
            <div key={i}
              style={{ ...s.colorDot, background: c, outline: form.color === i ? '2px solid #aaa' : 'none' }}
              onClick={() => setF('color', i)}
            />
          ))}
        </div>

        {/* 메모 */}
        <input style={s.input} placeholder="메모 (선택)"
          value={form.note} onChange={e => setF('note', e.target.value)} />

        {/* 루틴 구분선 */}
        <div style={{ borderTop: '1px solid #222530', paddingTop: 10 }}>
          <label style={s.chkLabel}>
            <input type="checkbox" checked={form.isRoutine}
              onChange={e => setF('isRoutine', e.target.checked)} />
            <span style={{ color: '#9aa' }}>↻&nbsp; 루틴 설정</span>
          </label>

          {form.isRoutine && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>

              {/* 반복 유형 */}
              <div style={s.row}>
                {[['daily', '매일'], ['weekly', '매주'], ['monthly', '매월']].map(([val, label]) => (
                  <button key={val}
                    style={{ ...s.typeBtn, ...(form.routineType === val ? s.typeBtnActive : {}) }}
                    onClick={() => setF('routineType', val)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* 매주: 요일 선택 */}
              {form.routineType === 'weekly' && (
                <div style={s.row}>
                  {DAY_NAMES.map((d, i) => (
                    <button key={i}
                      style={{
                        ...s.dayBtn,
                        ...(form.routineDays.includes(i) ? s.dayBtnActive : {}),
                      }}
                      onClick={() => setF('routineDays',
                        form.routineDays.includes(i)
                          ? form.routineDays.filter(x => x !== i)
                          : [...form.routineDays, i]
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}

              {/* 매월: 날짜 선택 */}
              {form.routineType === 'monthly' && (
                <div style={{ ...s.row, gap: 6 }}>
                  <span style={{ fontSize: 12, color: '#778' }}>매월</span>
                  <input type="number" min={1} max={31}
                    style={{ ...s.input, width: 64, textAlign: 'center' }}
                    value={form.routineDayOfMonth}
                    onChange={e => setF('routineDayOfMonth', Number(e.target.value))}
                  />
                  <span style={{ fontSize: 12, color: '#778' }}>일</span>
                </div>
              )}

              {/* 시작일 */}
              <div style={s.row}>
                <span style={{ fontSize: 11, color: '#556', width: 34, flexShrink: 0 }}>시작</span>
                <input type="date" style={{ ...s.input, flex: 1 }}
                  value={form.routineStart}
                  onChange={e => setF('routineStart', e.target.value)}
                />
              </div>

              {/* 종료일 */}
              <div style={s.row}>
                <span style={{ fontSize: 11, color: '#556', width: 34, flexShrink: 0 }}>종료</span>
                <input type="date" style={{ ...s.input, flex: 1 }}
                  value={form.routineEnd}
                  onChange={e => setF('routineEnd', e.target.value)}
                />
                {form.routineEnd && (
                  <button onClick={() => setF('routineEnd', '')}
                    style={{ background: 'none', border: 'none', color: '#556', cursor: 'pointer', fontSize: 12 }}>
                    ✕
                  </button>
                )}
              </div>
              <div style={{ fontSize: 10, color: '#445' }}>종료일 미설정 시 무기한 반복</div>

            </div>
          )}
        </div>

        {/* 버튼 */}
        <div style={{ ...s.row, marginTop: 6 }}>
          {isEdit && (
            <button style={s.delBtn} onClick={onDelete}>삭제</button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button style={s.cancelBtn} onClick={onClose}>취소</button>
            <button style={s.saveBtn} onClick={onSave}>저장</button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── SchedulePage ────────────────────────────────────────────────
const EMPTY_FORM = {
  title: '', color: 0, allDay: true, time: '09:00', note: '',
  isRoutine: false,
  routineType: 'weekly',
  routineDays: [],
  routineDayOfMonth: 1,
  routineStart: fmt(new Date()),
  routineEnd: '',
}

export default function SchedulePage() {
  const [view,     setView    ] = useState('week')   // 'week' | 'month'
  const [baseDate, setBaseDate] = useState(new Date())
  const [items,    setItems   ] = useState(loadItems)
  const [modal,    setModal   ] = useState(null)     // { date? } | { itemIdx }
  const [form,     setForm    ] = useState(EMPTY_FORM)

  const today = fmt(new Date())
  const setF  = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const persist = (next) => { setItems(next); saveItems(next) }

  const openNew = (dateStr) => {
    const dom = new Date(dateStr).getDate()
    setForm({ ...EMPTY_FORM, routineStart: dateStr, routineDayOfMonth: dom })
    setModal({ date: dateStr })
  }

  const openEdit = (itemIdx) => {
    const item = items[itemIdx]
    if (!item) return
    setForm({
      title:             item.title,
      color:             item.color ?? 0,
      allDay:            item.allDay ?? true,
      time:              item.time || '09:00',
      note:              item.note || '',
      isRoutine:         !!item.routine,
      routineType:       item.routine?.type || 'weekly',
      routineDays:       item.routine?.days || [],
      routineDayOfMonth: item.routine?.dayOfMonth || 1,
      routineStart:      item.routine?.startDate || item.date || fmt(new Date()),
      routineEnd:        item.routine?.endDate || '',
    })
    setModal({ itemIdx })
  }

  const handleSave = () => {
    if (!form.title.trim()) return

    const base = {
      id:     modal.itemIdx !== undefined ? items[modal.itemIdx].id : Date.now(),
      title:  form.title.trim(),
      color:  form.color,
      allDay: form.allDay,
      time:   form.allDay ? null : form.time,
      note:   form.note,
    }

    if (form.isRoutine) {
      base.routine = {
        type:       form.routineType,
        ...(form.routineType === 'weekly'  && { days:       form.routineDays }),
        ...(form.routineType === 'monthly' && { dayOfMonth: form.routineDayOfMonth }),
        startDate: form.routineStart || fmt(new Date()),
        endDate:   form.routineEnd   || null,
      }
    } else {
      base.date = modal.date ?? items[modal.itemIdx]?.date
    }

    if (modal.itemIdx !== undefined) {
      persist(items.map((it, i) => i === modal.itemIdx ? base : it))
    } else {
      persist([...items, base])
    }
    setModal(null)
  }

  const handleDelete = () => {
    persist(items.filter((_, i) => i !== modal.itemIdx))
    setModal(null)
  }

  // 뷰 이동
  const prev = () => {
    const d = new Date(baseDate)
    view === 'week' ? d.setDate(d.getDate() - 7) : d.setMonth(d.getMonth() - 1)
    setBaseDate(d)
  }
  const next = () => {
    const d = new Date(baseDate)
    view === 'week' ? d.setDate(d.getDate() + 7) : d.setMonth(d.getMonth() + 1)
    setBaseDate(d)
  }

  // 헤더 라벨
  const periodLabel = view === 'week'
    ? (() => {
        const days = getWeekDays(baseDate)
        return `${days[0].getMonth()+1}월 ${days[0].getDate()}일 ~ ${days[6].getMonth()+1}월 ${days[6].getDate()}일`
      })()
    : `${baseDate.getFullYear()}년 ${baseDate.getMonth()+1}월`

  return (
    <div style={s.page}>
      {/* 헤더 */}
      <div style={s.header}>
        {/* 뷰 전환 */}
        <div style={s.viewToggle}>
          {[['week', '주간'], ['month', '월간']].map(([v, label]) => (
            <button key={v}
              style={{ ...s.viewBtn, ...(view === v ? s.viewBtnActive : {}) }}
              onClick={() => setView(v)}
            >
              {label}
            </button>
          ))}
        </div>

        <button style={s.navBtn} onClick={prev}>‹</button>
        <span style={s.periodLabel}>{periodLabel}</span>
        <button style={s.navBtn} onClick={next}>›</button>
        <button style={s.todayBtn} onClick={() => setBaseDate(new Date())}>오늘</button>
      </div>

      {/* 뷰 렌더 */}
      {view === 'week'
        ? <WeekView  baseDate={baseDate} items={items} today={today} onDayClick={openNew} onItemClick={openEdit} />
        : <MonthView baseDate={baseDate} items={items} today={today} onDayClick={openNew} onItemClick={openEdit} />
      }

      {/* 모달 */}
      {modal && (
        <ScheduleModal
          form={form} setF={setF}
          isEdit={modal.itemIdx !== undefined}
          dateLabel={modal.date ?? items[modal.itemIdx]?.date ?? ''}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ─── 스타일 ───────────────────────────────────────────────────────
const s = {
  page:   { height: '100%', display: 'flex', flexDirection: 'column', background: '#13151c' },
  header: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
    borderBottom: '1px solid #1e2130', flexShrink: 0, background: '#0f1118',
  },
  viewToggle: { display: 'flex', borderRadius: 5, overflow: 'hidden', border: '1px solid #252a38' },
  viewBtn: {
    background: 'none', border: 'none', color: '#556', fontSize: 11,
    padding: '4px 12px', cursor: 'pointer', transition: 'background .15s',
  },
  viewBtnActive: { background: '#1a2438', color: '#8ab' },
  navBtn: {
    background: 'none', border: 'none', color: '#556', fontSize: 18,
    cursor: 'pointer', padding: '0 4px', lineHeight: 1,
  },
  periodLabel: { fontSize: 13, color: '#8a9ab0', minWidth: 170, textAlign: 'center' },
  todayBtn: {
    marginLeft: 'auto', background: 'none', border: '1px solid #252a38',
    borderRadius: 4, color: '#667', fontSize: 11, padding: '3px 10px', cursor: 'pointer',
  },

  // 모달
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)',
    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modalBox: {
    width: 340, background: '#1c2030', border: '1px solid #2a2e3a',
    borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', gap: 9,
    maxHeight: '90vh', overflowY: 'auto',
  },
  modalTitle: { fontSize: 13, color: '#8a9ab0', marginBottom: 2 },
  input: {
    background: '#151820', border: '1px solid #252a38', borderRadius: 5,
    padding: '6px 8px', color: '#c8d0e0', fontSize: 12, outline: 'none', width: '100%',
    boxSizing: 'border-box',
  },
  row:      { display: 'flex', alignItems: 'center', gap: 8 },
  chkLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#778', cursor: 'pointer' },
  colorRow: { display: 'flex', gap: 7 },
  colorDot: { width: 16, height: 16, borderRadius: '50%', cursor: 'pointer', outlineOffset: 2 },

  // 루틴 버튼
  typeBtn: {
    flex: 1, background: 'none', border: '1px solid #252a38',
    borderRadius: 4, color: '#667', fontSize: 11, padding: '4px 0', cursor: 'pointer',
  },
  typeBtnActive: { background: '#182030', border: '1px solid #2a4060', color: '#7ac' },

  // 요일 버튼
  dayBtn: {
    width: 30, height: 28, background: 'none', border: '1px solid #252a38',
    borderRadius: 4, color: '#556', fontSize: 11, cursor: 'pointer',
  },
  dayBtnActive: { background: '#182030', border: '1px solid #2a4060', color: '#7ac' },

  // 액션 버튼
  delBtn:    { background: 'none', border: '1px solid #4a2020', borderRadius: 4, color: '#a06060', fontSize: 11, padding: '5px 10px', cursor: 'pointer' },
  cancelBtn: { background: 'none', border: '1px solid #252a38', borderRadius: 4, color: '#556',    fontSize: 11, padding: '5px 10px', cursor: 'pointer' },
  saveBtn:   { background: '#182030', border: '1px solid #2a4060', borderRadius: 4, color: '#7ac', fontSize: 11, padding: '5px 14px', cursor: 'pointer' },
}
