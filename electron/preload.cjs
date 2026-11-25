const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('lingxi', {
  platform: process.platform,
  connect: config => ipcRenderer.invoke('gateway:connect', config),
  disconnect: () => ipcRenderer.invoke('gateway:disconnect'),
  quota: () => ipcRenderer.invoke('gateway:quota'),
  startChat: payload => ipcRenderer.invoke('gateway:chat', payload),
  stopChat: id => ipcRenderer.invoke('gateway:stop', id),
  writeClipboard: text => ipcRenderer.invoke('desktop:copy', text),
  onChat: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('gateway:event', listener)
    return () => ipcRenderer.removeListener('gateway:event', listener)
  },
})
