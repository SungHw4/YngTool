const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron')
const path = require('path')
const isDev = process.env.ELECTRON_IS_DEV === '1'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,          // 커스텀 타이틀바
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../../public/icon.ico'),
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../build/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ─── IPC: 윈도우 컨트롤 ───────────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow.minimize())
ipcMain.on('window-maximize', () => {
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
})
ipcMain.on('window-close', () => mainWindow.close())

// ─── IPC: SVN ────────────────────────────────────────────────────
const { execSync, exec, execFile } = require('child_process')

ipcMain.handle('svn:log', async (_, { repoPath, limit = 20 }) => {
  return new Promise((resolve) => {
    const cmd = `svn log "${repoPath}" --limit ${limit} --xml`
    exec(cmd, { encoding: 'utf8' }, (err, stdout) => {
      if (err) return resolve({ error: err.message, items: [] })
      try {
        const items = parseSvnXml(stdout)
        resolve({ items })
      } catch (e) {
        resolve({ error: e.message, items: [] })
      }
    })
  })
})

ipcMain.handle('svn:check', async () => {
  try {
    execSync('svn --version --quiet', { encoding: 'utf8', stdio: 'pipe' })
    return { available: true }
  } catch {
    return { available: false }
  }
})

function parseSvnXml(xml) {
  // 간단한 SVN XML 파싱 (xml2js 없이)
  const entries = []
  const logentryRegex = /<logentry\s+revision="(\d+)">([\s\S]*?)<\/logentry>/g
  let m
  while ((m = logentryRegex.exec(xml)) !== null) {
    const revision = m[1]
    const body = m[2]
    const author = (body.match(/<author>(.*?)<\/author>/) || [])[1] || ''
    const date = (body.match(/<date>(.*?)<\/date>/) || [])[1] || ''
    const msg = (body.match(/<msg>([\s\S]*?)<\/msg>/) || [])[1]?.trim() || ''
    entries.push({ revision, author, date, message: msg, type: 'svn' })
  }
  return entries
}

// ─── IPC: Git ────────────────────────────────────────────────────
ipcMain.handle('git:log', async (_, { repoPath, limit = 20 }) => {
  return new Promise((resolve) => {
    const fmt = '--pretty=format:%H\x1f%an\x1f%ae\x1f%ai\x1f%s'
    execFile('git', ['-C', repoPath, 'log', fmt, `-n`, String(limit)], { encoding: 'utf8' }, (err, stdout) => {
      if (err) return resolve({ error: err.message, items: [] })
      const items = stdout.trim().split('\n').filter(Boolean).map(line => {
        const [hash, author, email, date, ...msgParts] = line.split('\x1f')
        return { hash: hash?.slice(0, 7), author, email, date, message: msgParts.join('\x1f'), type: 'git' }
      })
      resolve({ items })
    })
  })
})

ipcMain.handle('git:diff', async (_, { repoPath, hash }) => {
  return new Promise((resolve) => {
    execFile('git', ['-C', repoPath, 'show', hash, '--stat'], { encoding: 'utf8' }, (err, stdout) => {
      if (err) return resolve({ error: err.message, diff: '' })
      resolve({ diff: stdout })
    })
  })
})

// ─── IPC: 연결 상태 체크 ─────────────────────────────────────────
const http = require('http')
const https = require('https')

ipcMain.handle('connection:check', async (_, { url, timeout = 3000 }) => {
  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https') ? https : http
      const req = client.get(url, { timeout }, () => resolve({ ok: true }))
      req.on('error', () => resolve({ ok: false }))
      req.on('timeout', () => { req.destroy(); resolve({ ok: false }) })
    } catch {
      resolve({ ok: false })
    }
  })
})

// ─── IPC: Anthropic Usage ────────────────────────────────────────
ipcMain.handle('anthropic:usage', async (_, { apiKey }) => {
  return new Promise((resolve) => {
    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const start = startOfMonth.toISOString().split('T')[0]
      const end = now.toISOString().split('T')[0]
      const options = {
        hostname: 'api.anthropic.com',
        path: `/v1/usage?start_date=${start}&end_date=${end}`,
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      }
      const req = https.request(options, (res) => {
        let body = ''
        res.on('data', chunk => body += chunk)
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) return resolve({ error: `HTTP ${res.statusCode}` })
            resolve({ data: JSON.parse(body) })
          } catch {
            resolve({ error: 'parse error' })
          }
        })
      })
      req.on('error', (e) => resolve({ error: e.message }))
      req.end()
    } catch (e) {
      resolve({ error: e.message })
    }
  })
})

// ─── IPC: 설정 저장/로드 ─────────────────────────────────────────
const fs = require('fs')
const configPath = path.join(app.getPath('userData'), 'config.json')

ipcMain.handle('config:load', async () => {
  try {
    if (!fs.existsSync(configPath)) return { data: getDefaultConfig() }
    const raw = fs.readFileSync(configPath, 'utf8')
    return { data: JSON.parse(raw) }
  } catch (e) {
    return { data: getDefaultConfig(), error: e.message }
  }
})

ipcMain.handle('config:save', async (_, config) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

function getDefaultConfig() {
  return {
    mantis: { baseUrl: '', apiToken: '', enabled: false },
    jira: { baseUrl: '', email: '', apiToken: '', enabled: false },
    svn: { repoPaths: [], enabled: false },
    git: { repoPaths: [], enabled: false },
    ai: { anthropicKey: '', openaiKey: '' },
    general: { pollIntervalMinutes: 5, theme: 'dark' },
  }
}

// ─── IPC: 알림 저장/로드 ─────────────────────────────────────────
const notifPath = path.join(app.getPath('userData'), 'notifications.json')

ipcMain.handle('notifications:load', async () => {
  try {
    if (!fs.existsSync(notifPath)) return { items: [], jiraSnapshot: {}, notifiedSchedules: [] }
    return JSON.parse(fs.readFileSync(notifPath, 'utf8'))
  } catch {
    return { items: [], jiraSnapshot: {}, notifiedSchedules: [] }
  }
})

ipcMain.handle('notifications:save', async (_, data) => {
  try {
    fs.writeFileSync(notifPath, JSON.stringify(data, null, 2), 'utf8')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ─── IPC: Windows 토스트 알림 ────────────────────────────────────
const { Notification } = require('electron')

ipcMain.handle('notification:toast', async (_, { title, body }) => {
  try {
    if (Notification.isSupported()) {
      new Notification({ title, body, silent: false }).show()
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})
