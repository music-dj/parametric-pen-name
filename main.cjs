const {app,BrowserWindow,ipcMain,dialog}=require('electron');
const path=require('node:path'),fs=require('node:fs/promises');
const config=require('./app-config.json');
let current=null,request=0;
app.setName(config.slug);
app.whenReady().then(async()=>{
 const backend=await import('./'+config.generator),generate=backend[config.exportName];
 const {encodeSTL,encode3MF}=await import('./exporters.mjs');
 const win=new BrowserWindow({title:config.title,width:1400,height:960,minWidth:1000,minHeight:700,backgroundColor:'#101820',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 win.setMenuBarVisibility(false);win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
 ipcMain.handle('generate',async(_,settings)=>{
  const id=++request;current=null;const result=await generate(settings);
  if(id===request)current=result;
  return {kind:config.id,text:result.text,parts:result.parts,dimensions:result.dimensions,settings:result.settings,warnings:result.warnings||[]};
 });
 const save=async(type,file)=>{if(!current||!['stl','3mf'].includes(type))throw Error('Generate a valid model first.');const model=current;await fs.writeFile(file,type==='stl'?encodeSTL(model):encode3MF(model));return file;};
 ipcMain.handle('export',async(_,type)=>{
  if(!current)throw Error('Generate a valid model first.');const filename=current.text.replace(/[<>:"/\\|?*]/g,'_');
  const {canceled,filePath}=await dialog.showSaveDialog(win,{defaultPath:filename+'.'+type,filters:[{name:type.toUpperCase(),extensions:[type]}]});
  return canceled?null:save(type,filePath);
 });
 const verify=process.argv.includes('--verify');
 if(verify)ipcMain.handle('verify-export',async()=>{
  await fs.mkdir(path.join(__dirname,'examples'),{recursive:true});
  await save('stl',path.join(__dirname,'examples/example.stl'));await save('3mf',path.join(__dirname,'examples/example.3mf'));return true;
 });
 await win.loadFile('index.html');
 if(verify){
  try{
   let ready=false;for(let i=0;i<1200;i++){ready=await win.webContents.executeJavaScript('window.initialComplete===true');if(ready)break;await new Promise(r=>setTimeout(r,100));}
   if(!ready)throw Error('Initial model timeout');
   const result=await win.webContents.executeJavaScript('window.verifyStandalone()');
   await new Promise(r=>setTimeout(r,400));
   await fs.mkdir(path.join(__dirname,'docs'),{recursive:true});
   const data=await win.webContents.executeJavaScript('window.captureModel()');
   await fs.writeFile(path.join(__dirname,'docs/model.png'),Buffer.from(data.split(',')[1],'base64'));
   try{win.webContents.debugger.attach('1.3');const screen=await win.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png',fromSurface:true});await fs.writeFile(path.join(__dirname,'docs/app.png'),Buffer.from(screen.data,'base64'));win.webContents.debugger.detach();}catch(e){await fs.writeFile(path.join(__dirname,'docs/capture-error.txt'),String(e));await fs.copyFile(path.join(__dirname,'docs/model.png'),path.join(__dirname,'docs/app.png'));}
   await fs.writeFile(path.join(__dirname,'docs/ui-test.json'),JSON.stringify(result,null,2));
   app.exit(result.ok?0:1);
  }catch(e){await fs.mkdir(path.join(__dirname,'docs'),{recursive:true});await fs.writeFile(path.join(__dirname,'docs/ui-error.txt'),String(e));console.error(e);app.exit(1);}
 }
}).catch(e=>{console.error(e);app.exit(1);});
app.on('window-all-closed',()=>app.quit());
