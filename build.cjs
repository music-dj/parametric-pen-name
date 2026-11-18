const fs=require('node:fs'),path=require('node:path');
const config=require('./app-config.json'),pkg=require('./package.json');
if(process.platform!=='win32')throw Error('Windows packaging must run on Windows.');
const output=path.resolve(process.argv[2]||path.join('dist',config.slug+'-windows'));
if(fs.existsSync(output))throw Error('Output already exists; choose a new folder.');
const electron=process.env.ELECTRON_DIST||path.join(path.dirname(require.resolve('electron/package.json')),'dist');
fs.cpSync(electron,output,{recursive:true});fs.renameSync(path.join(output,'electron.exe'),path.join(output,config.exe+'.exe'));
const dest=path.join(output,'resources/app');fs.mkdirSync(dest,{recursive:true});
for(const name of fs.readdirSync(__dirname)){
 if(['node_modules','dist','.git','runtime','work'].includes(name)||name.endsWith('.log'))continue;
 fs.cpSync(path.join(__dirname,name),path.join(dest,name),{recursive:true});
}
for(const name of Object.keys(pkg.dependencies).filter(n=>n!=='electron'))fs.cpSync(path.join(__dirname,'node_modules',name),path.join(dest,'node_modules',name),{recursive:true});
if(pkg.dependencies['bidi-js'])fs.cpSync(path.join(__dirname,'node_modules/require-from-string'),path.join(dest,'node_modules/require-from-string'),{recursive:true});
if(config.scad){
 const source=process.env.OPENSCAD_DIR||path.join(__dirname,'runtime/openscad');
 if(!fs.existsSync(path.join(source,'openscad.com')))throw Error('Set OPENSCAD_DIR to an OpenSCAD Windows installation before packaging.');
 fs.cpSync(source,path.join(dest,'runtime/openscad'),{recursive:true});
 fs.writeFileSync(path.join(output,'OPENSCAD-NOTICE.md'),'OpenSCAD is a separate, unmodified GPL-2.0-or-later program. Bundled version: 2021.01. Project and corresponding source: https://github.com/openscad/openscad/tree/openscad-2021.01 . Application and model files retain their own licenses.\n');
}
fs.copyFileSync(path.join(__dirname,'README.md'),path.join(output,'README.md'));console.log(output);
