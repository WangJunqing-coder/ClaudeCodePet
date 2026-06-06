const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ccPet', {
  // Claude Code 状态更新
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (_event, data) => callback(data));
  },

  // 窗口拖拽
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
  setWindowPosition: (x, y) => ipcRenderer.send('set-window-position', { x, y }),

  // 鼠标穿透控制（拖拽时关闭穿透，平时开启）
  setIgnoreMouse: (ignore) => {
    ipcRenderer.send('set-ignore-mouse', ignore);
  },

  // 窗口置顶
  toggleAlwaysOnTop: (flag) => {
    ipcRenderer.send('toggle-always-on-top', flag);
  },

  // 宠物导入与管理
  importPetZip: () => ipcRenderer.invoke('import-pet-zip'),
  listPets: () => ipcRenderer.invoke('list-pets'),
  getPetDir: (petId) => ipcRenderer.invoke('get-pet-dir', petId),
  getCurrentPetId: () => ipcRenderer.invoke('get-current-pet-id'),
  setCurrentPetId: (petId) => ipcRenderer.send('set-current-pet-id', petId),
});
