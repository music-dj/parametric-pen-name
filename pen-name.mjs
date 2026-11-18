
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {cad,solidPart} from './cad-core.mjs';
import {openscadExecutable} from './openscad-runtime.mjs';
const run=promisify(execFile),folder=path.dirname(fileURLToPath(import.meta.url)),cache=new Map();
export const penDefaults={project:'pen',text:'Mickey',font:'comic',penLetterHeight:12,letterThickness:1.4,baseHeight:12,outlineMargin:2.3,holeOrientation:'FRONTBACK',holeDiameter:7.8,holeLength:150,holeX:21,holeY:4,holeZ:6,autoHoleZ:true,rtl:false,baseColor:'#1B40D1',topColor:'#FFFFFF'};
import {stlSolid} from './stl.mjs';
export {stlSolid} from './stl.mjs';
export async function generatePen(input={}){
 const s={...penDefaults,...input,project:'pen',autoHoleCenter:false};
 if(typeof s.text!=='string'||!s.text.trim()||s.text.length>60||/[^\p{Letter}\p{Number}\p{Mark} ._-]/u.test(s.text))throw Error('اكتب اسمًا صالحًا حتى 60 حرفًا.');
 if(!['comic','luckiest','amiri'].includes(s.font)||!['FRONTBACK','TOPBOTTOM'].includes(s.holeOrientation))throw Error('إعداد غير صحيح.');
 for(const [k,a,b]of [['penLetterHeight',6,40],['letterThickness',.4,8],['baseHeight',4,40],['outlineMargin',.5,10],['holeDiameter',1,25],['holeLength',1,500],['holeX',-500,500],['holeY',-100,100],['holeZ',0,40]]){s[k]=Number(s[k]);if(!Number.isFinite(s[k])||s[k]<a||s[k]>b)throw Error(`قيمة غير صحيحة: ${k}`);}
 for(const k of ['baseColor','topColor'])if(!/^#[0-9a-f]{6}$/i.test(s[k]))throw Error('لون غير صحيح.');
 if(typeof s.rtl!=='boolean'||typeof s.autoHoleZ!=='boolean')throw Error('إعداد غير صحيح.');
 if(s.autoHoleZ)s.holeZ=s.baseHeight/2;
 const key=JSON.stringify(s);if(cache.has(key))return structuredClone(cache.get(key));
 const exe=openscadExecutable();
 try{await fs.access(exe);}catch{throw Error('OpenSCAD مطلوب لتوليد Pen Name من الكود الأصلي.');}
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'pen-original-')),solids=[];
 try{
  const params={text_string:s.text,font_name:s.font==='comic'?'Comic Neue:style=Bold':s.font==='amiri'?'Amiri:style=Bold':'Luckiest Guy',letter_height:s.penLetterHeight,letter_thickness:s.letterThickness,base_height:s.baseHeight,outline_margin:s.outlineMargin,hole_orientation:s.holeOrientation,hole_diameter:s.holeDiameter,hole_length:s.holeLength,hole_x:s.holeX,hole_y:s.holeY,hole_z:s.holeZ,rtl:s.rtl};
  const definitions=Object.entries(params).flatMap(([k,v])=>['-D',`${k}=${JSON.stringify(v)}`]);
  for(const part of ['base','letters','all']){
   const output=path.join(temp,part+'.stl');
   await run(exe,['-o',output,...definitions,'-D',`part="${part}"`,path.join(folder,'pen-original.scad')],{windowsHide:true,timeout:120000,maxBuffer:1024*1024,env:{...process.env,OPENSCAD_FONT_PATH:path.join(folder,'assets')}});
   solids.push(stlSolid(await fs.readFile(output)));
  }
  const whole=solids[2],box=whole.boundingBox(),shift=box.min.map((v,i)=>i<2?-(v+box.max[i])/2:0),moved=solids.map(o=>o.translate(shift));solids.push(...moved);
  const model={kind:'pen',text:s.text,settings:s,parts:[solidPart(moved[0],'0-base','base',s.baseColor,[0,0,0]),solidPart(moved[1],'1-letters-top','top',s.topColor,[0,0,0])],stlParts:[solidPart(moved[2],'Pen Name','base',s.baseColor,[0,0,0])],dimensions:box.max.map((v,i)=>v-box.min[i]),warnings:[],engine:'OpenSCAD original source',sourceBounds:box};
  cache.set(key,structuredClone(model));if(cache.size>8)cache.delete(cache.keys().next().value);return model;
 }finally{solids.forEach(o=>o.delete());await fs.rm(temp,{recursive:true,force:true});}
}
