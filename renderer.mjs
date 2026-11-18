import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const config=await (await fetch('./app-config.json')).json(),$=id=>document.getElementById(id);
let model=null,groups=[],ticket=0,timer,busy=false;
for(const item of config.fields){
 const label=document.createElement('label'),input=document.createElement(item.type==='select'?'select':'input');label.textContent=item.label;input.id=item.key;
 if(item.type==='select')for(const [value,text]of item.options){const option=document.createElement('option');option.value=value;option.textContent=text;input.append(option);}
 else{input.type=item.type;if(item.type==='number'){input.min=item.min;input.max=item.max;input.step=item.step;input.dir='ltr';}if(item.type==='checkbox')label.className='check';}
 label.htmlFor=item.key;label.append(input);$('fields').append(label);
 input.addEventListener('input',schedule);
}
$('note').textContent=config.note;
for(const sample of config.samples){const button=document.createElement('button');button.textContent=sample;button.onclick=()=>{$('text').value=sample;clearTimeout(timer);rebuild();};$('samples').append(button);}
if(config.id==='mechanical'){
 $('symbols').hidden=false;
 for(const [symbol,name]of [['♥','Heart / قلب'],['★','Star / نجمة'],['☆','Outline star'],['☺','Smile / ابتسامة'],['☀','Sun / شمس'],['☾','Moon / هلال'],['♫','Music'],['✿','Flower'],['∞','Infinity'],['◆','Diamond'],['●','Circle'],['✓','Check'],['✚','Plus'],['⚡','Lightning']]){
  const button=document.createElement('button');button.textContent=symbol;button.title=name;button.setAttribute('aria-label',name);button.onmousedown=e=>e.preventDefault();button.onclick=()=>{
   const field=$('text'),start=field.selectionStart??field.value.length,end=field.selectionEnd??start;
   if(field.value.length-end+start+symbol.length>20){$('status').textContent='Maximum 20 elements / الحد الأقصى 20 عنصرًا';return;}
   field.setRangeText(symbol,start,end,'end');field.focus();schedule();
  };$('symbols').append(button);
 }
}
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,4000);camera.up.set(0,0,1);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.setClearColor(0,0);$('viewport').append(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=15;controls.maxDistance=1500;
scene.add(new THREE.HemisphereLight(0xe0f0ff,0x405669,2.6));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-50,-70,150);light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-250,right:250,top:250,bottom:-250,far:500});light.shadow.bias=-.0004;scene.add(light);
const fill=new THREE.DirectionalLight(0xbde7ff,1.1);fill.position.set(70,80,60);scene.add(fill);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(1500,1500),new THREE.ShadowMaterial({opacity:.22}));floor.position.z=-.1;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(600,120,0x49677d,0x2c4556);grid.rotation.x=Math.PI/2;grid.position.z=-.12;grid.material.transparent=true;grid.material.opacity=.22;scene.add(grid);
function resize(){const r=$('viewport').getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe($('viewport'));
function fit(view='iso'){
 if(!model)return;const [width,depth,height]=model.dimensions,target=height*.4;
 const dist=Math.max(65,width*2.05/camera.aspect,depth*2.3,height*2.8);
 controls.target.set(0,0,target);
 if(view==='top')camera.position.set(0,0,target+dist*1.15);
 else if(view==='side')camera.position.set(width/2+Math.max(height,depth/camera.aspect)*2.6+25,0,target);
 else if(config.id==='nameplate')camera.position.set(-width*.12,-dist,target+dist*.48);
 else camera.position.set(-width*.16,-dist*.68,target+dist*.9);
 controls.update();
}
function bend(){
 if(config.id!=='keychain')return;const angle=+$('bend').value*Math.PI/180;let world,previous,rotation=0;
 groups.forEach((group,i)=>{const pivot=group.userData.pivot;if(!i)world=new THREE.Vector3(...pivot);else{const delta=new THREE.Vector3(...pivot.map((v,j)=>v-previous[j]));delta.applyAxisAngle(new THREE.Vector3(0,1,0),rotation);world.add(delta);rotation+=angle;}group.position.copy(world);group.rotation.y=rotation;previous=pivot;});
}
function show(result){
 for(const group of groups){scene.remove(group);group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}groups=[];
 const map=new Map();for(const part of result.parts){
  const key=config.id==='keychain'?part.name.split('-')[0]:part.name;
  let group=map.get(key);if(!group){group=new THREE.Group();group.userData.pivot=part.pivot||[0,0,0];group.position.set(...group.userData.pivot);map.set(key,group);groups.push(group);scene.add(group);}
  const positions=new Float32Array(part.vertices);for(let i=0;i<positions.length;i+=3)for(let j=0;j<3;j++)positions[i+j]-=group.userData.pivot[j];
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(part.triangles),1));geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:part.color,roughness:.65,flatShading:true}));mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
 }
 model=result;bend();fit();$('dimensions').textContent=result.dimensions.map(v=>v.toFixed(2)).join(' × ');$('status').textContent=result.warnings.join(' ')||'جاهز للتصدير / Ready to export';
}
function settings(){const result={text:$('text').value,baseColor:$('baseColor').value,topColor:$('topColor').value};for(const f of config.fields){const field=$(f.key);result[f.key]=f.type==='checkbox'?field.checked:f.type==='number'?+field.value:field.value;}return result;}
function sync(){
 if(config.id==='pen'){$('holeX').disabled=$('holeOrientation').value==='FRONTBACK';$('holeY').disabled=$('holeOrientation').value==='TOPBOTTOM';$('holeZ').disabled=$('autoHoleZ').checked;if($('autoHoleZ').checked)$('holeZ').value=+$('baseHeight').value/2;}
 $('text').dir=/\p{Script=Arabic}/u.test($('text').value)?'rtl':'ltr';
}
function enable(value){$('export3mf').disabled=!value;$('exportStl').disabled=!value;}
function schedule(){sync();enable(false);clearTimeout(timer);timer=setTimeout(rebuild,config.scad?650:350);}
async function rebuild(){
 clearTimeout(timer);sync();const id=++ticket;busy=true;enable(false);$('busy').hidden=false;
 try{const result=await window.studio.generate(settings());if(id!==ticket)return;show(result);enable(true);}
 catch(e){if(id===ticket){$('status').textContent=e.message;model=null;}}
 finally{if(id===ticket){busy=false;$('busy').hidden=true;window.initialComplete=true;}}
}
function defaults(){for(const [key,value]of Object.entries(config.defaults)){const field=$(key);if(!field)continue;if(field.type==='checkbox')field.checked=value;else field.value=value;}sync();}
$('text').maxLength=config.id==='keychain'||config.id==='mechanical'?20:80;
for(const id of ['text','baseColor','topColor'])$(id).addEventListener('input',schedule);
$('defaults').onclick=()=>{defaults();rebuild();};$('iso').onclick=()=>fit();$('top').onclick=()=>fit('top');$('side').onclick=()=>fit('side');
$('bend-control').hidden=config.id!=='keychain';$('bend').oninput=bend;
for(const [id,type]of [['exportStl','stl'],['export3mf','3mf']])$(id).onclick=async()=>{try{const saved=await window.studio.export(type);if(saved)$('status').textContent='Saved / تم الحفظ: '+saved;}catch(e){$('status').textContent=e.message;}};
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);}animate();
window.captureModel=()=>{resize();fit();renderer.setClearColor(0x182735,1);renderer.render(scene,camera);const result=renderer.domElement.toDataURL('image/png');renderer.setClearColor(0,0);return result;};
window.verifyStandalone=async()=>{
 const initial=!!model&&model.text===config.defaultText,fields=config.fields.every(f=>!!$(f.key));
 let changed=false,symbols=true;
 if(config.id==='keychain'){$('text').value='ADAM';await rebuild();changed=model?.text==='ADAM';$('bend').value=15;bend();changed=changed&&groups[2]?.rotation.y!==0;$('bend').value=0;}
 if(config.id==='nameplate'){$('text').value='أحمد';await rebuild();changed=model?.text==='أحمد'&&$('text').dir==='rtl';$('tilt').value=45;await rebuild();changed=changed&&model?.settings.tilt===45;}
 if(config.id==='pen'){$('holeOrientation').value='TOPBOTTOM';await rebuild();changed=model?.settings.holeOrientation==='TOPBOTTOM'&&!$('holeX').disabled&&$('holeY').disabled;}
 if(config.id==='mechanical'){$('text').value='ALI';$('text').setSelectionRange(1,2);const heart=[...$('symbols').children].find(b=>b.textContent==='♥');heart.click();clearTimeout(timer);await rebuild();symbols=model?.text==='A♥I';$('mechanicalFont').value='Trebuchet MS:style=Bold';await rebuild();changed=model?.settings.mechanicalFont==='Trebuchet MS:style=Bold';}
 defaults();await rebuild();const restored=model?.text===config.defaultText;
 const exported=await window.studioVerify.export();
 const result={ok:initial&&fields&&changed&&symbols&&restored&&exported&&!busy,app:config.slug,initial,fields,changed,symbols,restored,exported,dimensions:model?.dimensions,parts:model?.parts.length,otherProjectTabs:document.querySelectorAll('[role=tab]').length};
 fit();return result;
};
defaults();resize();rebuild();
