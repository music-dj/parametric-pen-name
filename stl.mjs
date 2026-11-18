import {cad} from './cad-core.mjs';
export function stlSolid(bytes){
 const xyz=[],tri=[],map=new Map(),add=p=>{const k=p.join(',');if(!map.has(k)){map.set(k,xyz.length/3);xyz.push(...p);}tri.push(map.get(k));};
 if(bytes.length>=84&&84+bytes.readUInt32LE(80)*50===bytes.length){for(let i=0;i<bytes.readUInt32LE(80);i++)for(let j=0;j<3;j++)add([0,1,2].map(k=>bytes.readFloatLE(84+i*50+12+j*12+k*4)));}
 else for(const m of bytes.toString().matchAll(/vertex\s+([\deE+.-]+)\s+([\deE+.-]+)\s+([\deE+.-]+)/g))add(m.slice(1).map(Number));
 if(!tri.length)throw Error('OpenSCAD لم ينتج شبكة صالحة.');
 const mesh=new cad.Mesh({numProp:3,vertProperties:new Float32Array(xyz),triVerts:new Uint32Array(tri)});mesh.merge();return new cad.Manifold(mesh);
}
