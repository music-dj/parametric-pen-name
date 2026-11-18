import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
export function openscadExecutable(){
 const folder=path.dirname(fileURLToPath(import.meta.url)),windows=process.platform==='win32';
 const candidates=[process.env.OPENSCAD_PATH,path.join(folder,'runtime/openscad',windows?'openscad.com':'openscad'),...(windows?['C:/Program Files/OpenSCAD/openscad.com','C:/Program Files (x86)/OpenSCAD/openscad.com']:['/usr/bin/openscad','/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD'])].filter(Boolean);
 const installed=candidates.find(p=>fs.existsSync(p));if(installed)return installed;
 const found=spawnSync(windows?'where':'which',[windows?'openscad.com':'openscad'],{encoding:'utf8',windowsHide:true});
 const p=found.stdout?.trim().split(/\r?\n/)[0];if(found.status===0&&p&&fs.existsSync(p))return p;
 throw Error('OpenSCAD مطلوب. عيّن OPENSCAD_PATH أو احتفظ بالمحرك المرفق. / Set OPENSCAD_PATH or keep the bundled runtime.');
}
