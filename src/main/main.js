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
const { execSync, exec } = require('child_process')

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
    execSync('svn --version --quiet', { encoding: 'utf8' })
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
    const fmt = '--pretty=format:%H|%an|%ae|%ai|%s'
    const cmd = `git -C "${repoPath}" log ${fmt} -n ${limit}`
    exec(cmd, { encoding: 'utf8' }, (err, stdout) => {
      if (err) return resolve({ error: err.message, items: [] })
      const items = stdout.trim().split('\n').filter(Boolean).map(line => {
        const [hash, author, email, date, ...msgParts] = line.split('|')
        return { hash: hash?.slice(0, 7), author, email, date, message: msgParts.join('|'), type: 'git' }
      })
      resolve({ items })
    })
  })
})

ipcMain.handle('git:diff', async (_, { repoPath, hash }) => {
  return new Promise((resolve) => {
    const cmd = `git -C "${repoPath}" show ${hash} --stat`
    exec(cmd, { encoding: 'utf8' }, (err, stdout) => {
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
    svn: { repoPaths: [], enabled: true },
    git: { repoPaths: [], enabled: true },
    ai: { anthropicKey: '', openaiKey: '' },
    general: { pollIntervalMinutes: 5, theme: 'dark' },
  }
}
