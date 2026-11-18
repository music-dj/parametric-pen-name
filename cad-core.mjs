import Module from 'manifold-3d';
export const cad=await Module();cad.setup();const {Manifold:M,Mesh}=cad;
function sanitize(raw){
  const coords=[],indices=[],weld=new Map(),remap=[];
  for(let i=0;i<raw.numVert;i++){
    const p=Array.from(raw.vertProperties.slice(i*raw.numProp,i*raw.numProp+3),v=>Math.round(v*100000)/100000),key=p.join(',');
    if(!weld.has(key)){weld.set(key,coords.length/3);coords.push(...p);}remap[i]=weld.get(key);
  }
  for(let i=0;i<raw.triVerts.length;i+=3){const t=Array.from(raw.triVerts.slice(i,i+3),j=>remap[j]);if(new Set(t).size===3)indices.push(...t);}
  const xyz=new Float32Array(coords),parent=Array.from({length:coords.length/3},(_,i)=>i);
  const root=i=>parent[i]===i?i:(parent[i]=root(parent[i]));
  for(let i=0;i<indices.length;i+=3){
    const t=indices.slice(i,i+3),p=t.map(j=>Array.from(xyz.slice(j*3,j*3+3))),a=p[1].map((v,k)=>v-p[0][k]),b=p[2].map((v,k)=>v-p[0][k]);
    if(Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])===0){
      const edges=[[0,1],[1,2],[2,0]].map(([j,k])=>({j,k,d:Math.hypot(...p[j].map((v,n)=>v-p[k][n]))})).sort((a,b)=>a.d-b.d);
      if(edges[0].d<.01)parent[root(t[edges[0].k])]=root(t[edges[0].j]);
    }
  }
  const collapsed=[];
  for(let i=0;i<indices.length;i+=3){const t=indices.slice(i,i+3).map(root);if(new Set(t).size===3)collapsed.push(...t);}
  return {vertices:xyz,triangles:new Uint32Array(collapsed)};
}
function arrayPart(solid,name,role,color,pivot){
  if(solid.status()!=='NoError')throw Error(`فشل بناء مجسم مغلق: ${name} (${solid.status()})`);
  // Recheck after Float32 conversion, then discard numerical chips before serialization.
  const data=sanitize(solid.getMesh());
  const roundtrip=new M(new Mesh({numProp:3,vertProperties:data.vertices,triVerts:data.triangles}));
  const pieces=roundtrip.decompose(),clean=M.compose(pieces.filter(p=>p.volume()>.0001));
  const part={name,role,color,...sanitize(clean.getMesh()),pivot};
  clean.delete();pieces.forEach(p=>p.delete());roundtrip.delete();return part;
}

export {arrayPart as solidPart};
