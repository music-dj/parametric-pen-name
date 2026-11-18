const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('studio',{generate:s=>ipcRenderer.invoke('generate',s),export:t=>ipcRenderer.invoke('export',t)});

contextBridge.exposeInMainWorld('studioVerify',{export:()=>ipcRenderer.invoke('verify-export')});
