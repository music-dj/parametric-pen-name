import fs from 'node:fs';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {encodeSTL,encode3MF} from './exporters.mjs';
import {cad} from './cad-core.mjs';
const config=JSON.parse(fs.readFileSync(new URL('./app-config.json',import.meta.url)));
const generator=(await import('./'+config.generator))[config.exportName];
const cases=config.id==='keychain'?[{}, {text:'ADAM'},{text:'ALI'},{text:'M M'},{text:'ABCDEFGHIJKLM'},{text:'NOPQRSTUVWXYZ'},{topEnabled:false},{scale:70,topLayers:4},{ring:false}]:config.id==='nameplate'?[{},{text:'أحمد'},{text:'عبد الله'},{text:'مُحَمَّد'},{text:'علي 2026'},{text:'I',tilt:0},{text:'O',tilt:75,baseDepth:14},{topChamfer:0}]:config.id==='pen'?[{},{holeOrientation:'TOPBOTTOM'},{rtl:true,holeOrientation:'TOPBOTTOM',holeX:-21},{text:'OLIVER',font:'luckiest'},{autoHoleZ:false,holeZ:5}]:[{},{text:'A♥★',mechanicalFont:'Trebuchet MS:style=Bold'},{text:'AB',altura_letra:-1},{text:'AB',altura_letra:0},{text:'AB',mechanicalMode:'base'},{text:'AB',mechanicalMode:'texto'},{text:'ALI',eslabon_primer_elemento:false}];
const reports=[];
const from=p=>new cad.Manifold(new cad.Mesh({numProp:3,vertProperties:p.vertices,triVerts:p.triangles}));
for(const variation of cases){
 const model=await generator({...config.defaults,...variation}),solids=model.stlParts.map(from),parts=model.parts.map(from);
 try{
  for(const solid of [...solids,...parts]){assert.equal(solid.status(),'NoError');assert.ok(solid.volume()>0);}
  if(config.id==='keychain')for(let i=0;i<solids.length-1;i++){const overlap=solids[i].intersect(solids[i+1]);assert.ok(overlap.volume()<.01);overlap.delete();}
  if(config.id==='nameplate'){
   assert.equal(model.settings.chamfer,0);const pieces=solids[0].decompose();assert.equal(pieces.filter(p=>p.volume()>1e-6).length,1);pieces.forEach(p=>p.delete());
   const bottom=parts[0].slice(.01),middle=parts[0].slice(model.settings.baseThickness/2);assert.ok(Math.abs(bottom.bounds().min[0]-middle.bounds().min[0])<.002);bottom.delete();middle.delete();
  }
  if(config.id==='mechanical'&&model.text==='A♥★'){const glyphs=parts[1].decompose();assert.equal(glyphs.filter(p=>p.volume()>.001).length,3);glyphs.forEach(p=>p.delete());}
  const stl=encodeSTL(model),mf=encode3MF(model),zip=unzipSync(mf);assert.ok(stl.length>84);assert.ok(zip['Metadata/model_settings.config']);
  const colors=JSON.parse(strFromU8(zip['Metadata/project_settings.config'])).filament_colour;assert.equal(colors.length,new Set(model.parts.map(p=>p.color.toUpperCase())).size);
  if(!Object.keys(variation).length){fs.mkdirSync('examples',{recursive:true});fs.writeFileSync('examples/example.stl',stl);fs.writeFileSync('examples/example.3mf',mf);}
  reports.push({variation,dimensions:model.dimensions,closed:true,parts:parts.length,stlBytes:stl.length,threeMFBytes:mf.length});console.log('PASS',config.id,JSON.stringify(variation));
 }finally{[...solids,...parts].forEach(p=>p.delete());}
}
await assert.rejects(()=>generator({...config.defaults,text:''}));
if(config.id==='nameplate')await assert.rejects(()=>generator({...config.defaults,tilt:90}));
if(config.id==='mechanical')await assert.rejects(()=>generator({...config.defaults,diametro_interno_cilindro:20}));
if(config.id==='pen')await assert.rejects(()=>generator({...config.defaults,holeLength:NaN}));
fs.mkdirSync('docs',{recursive:true});fs.writeFileSync('docs/geometry-test.json',JSON.stringify({ok:true,app:config.slug,cases:reports},null,2));
console.log('All standalone geometry/export checks passed.');process.exit(0);
