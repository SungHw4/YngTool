import React, { useState, useEffect } from 'react'
import { useApp } from '../store/AppContext'

export default function SettingsPage() {
  const { state, dispatch } = useApp()
  const [form, setForm] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (state.config) setForm(JSON.parse(JSON.stringify(state.config)))
  }, [state.config])

  if (!form) return <div style={styles.loading}>설정 불러오는 중...</div>

  const set = (path, value) => {
    setForm(prev => {
      const next = { ...prev }
      const keys = path.split('.')
      let cur = next
      for (let i = 0; i < keys.length - 1; i++) {
        cur[keys[i]] = { ...cur[keys[i]] }
        cur = cur[keys[i]]
      }
      cur[keys[keys.length - 1]] = value
      return next
    })
    setSaved(false)
  }

  const handleSave = async () => {
    await window.electronAPI.saveConfig(form)
    dispatch({ type: 'SET_CONFIG', payload: form })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // 저장소 경로 배열 관리
  const addPath = (section) => {
    const cur = form[section]?.repoPaths || []
    set(`${section}.repoPaths`, [...cur, ''])
  }
  const setPath = (section, idx, val) => {
    const cur = [...(form[section]?.repoPaths || [])]
    cur[idx] = val
    set(`${section}.repoPaths`, cur)
  }
  const removePath = (section, idx) => {
    const cur = [...(form[section]?.repoPaths || [])]
    cur.splice(idx, 1)
    set(`${section}.repoPaths`, cur)
  }

  return (
    <div style={styles.page}>
      <div style={styles.inner}>

        {/* SVN */}
        <Section title="SVN 설정">
          <Toggle label="SVN 활성화" checked={form.svn?.enabled} onChange={v => set('svn.enabled', v)} />
          <Field label="저장소 경로 (여러 개 추가 가능)">
            {(form.svn?.repoPaths || []).map((p, i) => (
              <div key={i} style={styles.pathRow}>
                <input
                  style={styles.input} value={p}
                  onChange={e => setPath('svn', i, e.target.value)}
                  placeholder="C:\work\project"
                />
                <button style={styles.rmBtn} onClick={() => removePath('svn', i)}>✕</button>
              </div>
            ))}
            <button style={styles.addBtn} onClick={() => addPath('svn')}>+ 경로 추가</button>
          </Field>
        </Section>

        {/* Git */}
        <Section title="Git 설정">
          <Toggle label="Git 활성화" checked={form.git?.enabled} onChange={v => set('git.enabled', v)} />
          <Field label="저장소 경로 (여러 개 추가 가능)">
            {(form.git?.repoPaths || []).map((p, i) => (
              <div key={i} style={styles.pathRow}>
                <input
                  style={styles.input} value={p}
                  onChange={e => setPath('git', i, e.target.value)}
                  placeholder="C:\personal\project"
                />
                <button style={styles.rmBtn} onClick={() => removePath('git', i)}>✕</button>
              </div>
            ))}
            <button style={styles.addBtn} onClick={() => addPath('git')}>+ 경로 추가</button>
          </Field>
        </Section>

        {/* Mantis */}
        <Section title="Mantis 설정">
          <Toggle label="Mantis 활성화" checked={form.mantis?.enabled} onChange={v => set('mantis.enabled', v)} />
          <Field label="Mantis URL">
            <input style={styles.input} value={form.mantis?.baseUrl || ''}
              onChange={e => set('mantis.baseUrl', e.target.value)}
              placeholder="http://192.168.1.100/mantis"
            />
          </Field>
          <Field label="API Token">
            <input style={styles.input} type="password" value={form.mantis?.apiToken || ''}
              onChange={e => set('mantis.apiToken', e.target.value)}
              placeholder="Mantis 프로필 > API Token"
            />
          </Field>
        </Section>

        {/* Jira */}
        <Section title="Jira 설정">
          <Toggle label="Jira 활성화" checked={form.jira?.enabled} onChange={v => set('jira.enabled', v)} />
          <Field label="Jira URL">
            <input style={styles.input} value={form.jira?.baseUrl || ''}
              onChange={e => set('jira.baseUrl', e.target.value)}
              placeholder="https://company.atlassian.net"
            />
          </Field>
          <Field label="이메일">
            <input style={styles.input} value={form.jira?.email || ''}
              onChange={e => set('jira.email', e.target.value)}
              placeholder="you@company.com"
            />
          </Field>
          <Field label="API Token">
            <input style={styles.input} type="password" value={form.jira?.apiToken || ''}
              onChange={e => set('jira.apiToken', e.target.value)}
              placeholder="Atlassian Account > API Token"
            />
          </Field>
        </Section>

        {/* AI */}
        <Section title="AI API 설정">
          <Field label="Anthropic API Key (코드 리뷰)">
            <input style={styles.input} type="password" value={form.ai?.anthropicKey || ''}
              onChange={e => set('ai.anthropicKey', e.target.value)}
              placeholder="sk-ant-..."
            />
          </Field>
          <Field label="OpenAI API Key (선택)">
            <input style={styles.input} type="password" value={form.ai?.openaiKey || ''}
              onChange={e => set('ai.openaiKey', e.target.value)}
              placeholder="sk-..."
            />
          </Field>
        </Section>

        <button style={styles.saveBtn} onClick={handleSave}>
          {saved ? '✓ 저장됨' : '설정 저장'}
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={sty.section}>
      <h3 style={sty.sectionTitle}>{title}</h3>
      <div style={sty.sectionBody}>{children}</div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={sty.field}>
      <label style={sty.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} />
      <span style={{ fontSize: 13, color: '#bbb' }}>{label}</span>
    </div>
  )
}

const styles = {
  page: { height: '100%', overflowY: 'auto', background: '#161616' },
  inner: { maxWidth: 560, margin: '0 auto', padding: '20px 24px 40px' },
  loading: { padding: 24, color: '#666', fontSize: 13 },
  input: {
    width: '100%', background: '#2a2a2a', border: '1px solid #3a3a3a',
    borderRadius: 4, padding: '6px 10px', color: '#ccc', fontSize: 13,
    outline: 'none', marginBottom: 4,
  },
  pathRow: { display: 'flex', gap: 6, marginBottom: 4 },
  rmBtn: {
    background: 'none', border: '1px solid #3a3a3a', borderRadius: 4,
    color: '#666', cursor: 'pointer', padding: '0 8px', fontSize: 12,
  },
  addBtn: {
    background: 'none', border: '1px solid #3a3a3a', borderRadius: 4,
    color: '#666', cursor: 'pointer', padding: '4px 10px', fontSize: 11,
    marginTop: 2,
  },
  saveBtn: {
    marginTop: 24, width: '100%', padding: '10px',
    background: '#1a3d5c', border: '1px solid #2a6090',
    borderRadius: 6, color: '#7ac', fontSize: 14,
    cursor: 'pointer', fontWeight: 500,
  },
}

const sty = {
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 12, color: '#555', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 },
  sectionBody: { paddingLeft: 0 },
  field: { marginBottom: 12 },
  fieldLabel: { display: 'block', fontSize: 11, color: '#777', marginBottom: 4 },
}
