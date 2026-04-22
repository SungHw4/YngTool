const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 윈도우 컨트롤
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose:    () => ipcRenderer.send('window-close'),

  // SVN
  svnLog:   (opts) => ipcRenderer.invoke('svn:log', opts),
  svnCheck: ()     => ipcRenderer.invoke('svn:check'),

  // Git
  gitLog:  (opts) => ipcRenderer.invoke('git:log', opts),
  gitDiff: (opts) => ipcRenderer.invoke('git:diff', opts),

  // 연결 상태
  checkConnection: (opts) => ipcRenderer.invoke('connection:check', opts),

  // AI Usage
  anthropicUsage: (opts) => ipcRenderer.invoke('anthropic:usage', opts),

  // 알림
  loadNotifications:  ()     => ipcRenderer.invoke('notifications:load'),
  saveNotifications:  (data) => ipcRenderer.invoke('notifications:save', data),
  sendToast:          (opts) => ipcRenderer.invoke('notification:toast', opts),

  // 설정
  loadConfig: ()       => ipcRenderer.invoke('config:load'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
})
