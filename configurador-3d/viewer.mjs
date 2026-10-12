/** Visor Three.js. Geometría demostradora TEMPORAL, sustituible por GLB con licencia comprobada. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VIEW_ZONES, fitText, normalizeText, normalizeNumber } from './layout.mjs';

function textileBump() {
  const canvas = document.createElement('canvas'); canvas.width=128; canvas.height=128;
  const ctx = canvas.getContext('2d');ctx.fillStyle='#858585';ctx.fillRect(0,0,128,128);
  for(let y=0;y<128;y+=5)for(let x=0;x<128;x+=5){
    ctx.fillStyle=((x+y)%3)?'#989898':'#686868';ctx.fillRect(x+1,y+1,1.5,1.5);
  }
  const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(9,13);return t;
}
function stroke(points, radius, material) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),50,radius,7,false),material);
}
function jerseyBody(state){
  const g=new THREE.Group();g.name='NUBYRA · demostrador de volumen 3D (sin patrón industrial)';
  const shape=new THREE.Shape();
  shape.moveTo(-.56,1.19); shape.lineTo(-.29,1.30);
  shape.quadraticCurveTo(-.16,1.21,0,1.005);shape.quadraticCurveTo(.16,1.21,.29,1.30);
  shape.lineTo(.56,1.19);shape.bezierCurveTo(.49,.74,.57,.55,.69,.38);
  shape.lineTo(.56,.19);shape.lineTo(.52,-.53);shape.quadraticCurveTo(.58,-.90,.66,-1.18);
  shape.quadraticCurveTo(0,-1.28,-.66,-1.18);shape.quadraticCurveTo(-.58,-.90,-.52,-.53);
  shape.lineTo(-.56,.19);shape.lineTo(-.69,.38);shape.bezierCurveTo(-.57,.55,-.49,.74,-.56,1.19);
  const geo=new THREE.ExtrudeGeometry(shape,{depth:.085,bevelEnabled:true,bevelThickness:.014,bevelSize:.012,bevelSegments:3,curveSegments:16,steps:1});
  geo.translate(0,0,-.042);
  const pos=geo.getAttribute('position');
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),bulge=.09*Math.max(0,1-(x/.75)**2)*(.75+.25*Math.max(0,1-Math.abs(y)/1.3));
    pos.setZ(i,z+Math.sign(z||1)*bulge);
  }
  geo.computeVertexNormals();
  const fabric=new THREE.MeshPhysicalMaterial({color:state.base,roughness:.94,metalness:0,side:THREE.DoubleSide,bumpMap:textileBump(),bumpScale:.005,clearcoat:.035});
  const garment=new THREE.Mesh(geo,fabric);garment.castShadow=true;garment.receiveShadow=true;g.add(garment);
  const accentMat=new THREE.MeshStandardMaterial({color:state.accent,roughness:.8});
  const trimMat=new THREE.MeshStandardMaterial({color:state.trim,roughness:.76});
  // Los tubos indican un patrón visual conceptual, NO representan costuras homologadas.
  for (const side of [1,-1]){
    const z=side*.103;
    const outline=[[-.56,1.19,z],[-.56,.90,z],[-.53,.62,z],[-.69,.38,z]];
    g.add(stroke(outline,.021,accentMat));
    g.add(stroke(outline.map(([x,y,zz])=>[-x,y,zz]),.021,accentMat));
    g.add(stroke([[-.29,1.3,z],[-.14,1.21,z],[0,1.005,z],[.14,1.21,z],[.29,1.3,z]],.031,accentMat));
    for(const mirror of [-1,1]){
      const s=mirror;
      g.add(stroke([[s*.565,.28,z],[s*.53,-.10,z],[s*.54,-.48,z],[s*.61,-.91,z],[s*.66,-1.18,z]],.054,accentMat));
      g.add(stroke([[s*.61,-.65,z+.014*side],[s*.59,-.89,z+.014*side],[s*.63,-1.17,z+.014*side]],.015,trimMat));
    }
    g.add(stroke([[-.645,-1.18,z],[-.33,-1.215,z],[0,-1.235,z],[.33,-1.215,z],[.645,-1.18,z]],.009,trimMat));
  }
  return {group:g,fabric,accentMat,trimMat,garment};
}
function createPrintCanvas(){const el=document.createElement('canvas');el.width=1024;el.height=1536;return el;}
function printBlock(ctx,box,text,opts,alerts){
  const name=normalizeText(text,opts.maxLength??40).toLocaleUpperCase('es-ES');if(!name)return;
  const f=fitText(ctx,name,box,{maxFont:opts.max,minFont:opts.min,weight:opts.weight||800,margin:12});
  if(!f.fit){alerts.push(`El texto «${name.slice(0,25)}» no cabe en su zona.`);return;}
  ctx.save();ctx.fillStyle=opts.color;ctx.font=`${opts.weight||800} ${f.fontSize}px Inter,Arial,sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  if('letterSpacing' in ctx)ctx.letterSpacing=`${f.tracking}px`;
  ctx.fillText(f.text,box.x+box.width/2,box.y+box.height/2);ctx.restore();
}
function drawPrint(canvas,side,state,safeAreas,alerts){
 const ctx=canvas.getContext('2d');ctx.clearRect(0,0,1024,1536);const z=VIEW_ZONES[side];
 if(side==='front'){
  printBlock(ctx,z.brand,'N',{min:50,max:84,color:state.trim,weight:900},alerts);
  if(state.crest && state.crest.complete && state.crest.naturalWidth){
    const w=state.crest.naturalWidth,h=state.crest.naturalHeight,r=Math.min(z.crest.width/w,z.crest.height/h);
    ctx.drawImage(state.crest,z.crest.x+(z.crest.width-w*r)/2,z.crest.y+(z.crest.height-h*r)/2,w*r,h*r);
  }else{ctx.save();ctx.lineWidth=7;ctx.strokeStyle=state.accent;ctx.beginPath();ctx.moveTo(739,316);ctx.lineTo(810,316);ctx.lineTo(810,397);ctx.lineTo(773,423);ctx.lineTo(735,397);ctx.closePath();ctx.stroke();ctx.fillStyle=state.trim;ctx.font='700 42px Inter,Arial';ctx.textAlign='center';ctx.fillText('NC',773,379);ctx.restore();}
  printBlock(ctx,z.team,state.team,{min:23,max:60,color:state.text,weight:850},alerts);
  printBlock(ctx,z.sponsor,state.sponsorFront,{min:21,max:49,color:state.accent,weight:750},alerts);
  printBlock(ctx,z.number,normalizeNumber(state.number),{min:150,max:320,color:state.text,weight:900},alerts);
 }else{
  printBlock(ctx,z.brand,'N',{min:45,max:78,color:state.accent,weight:900},alerts);
  printBlock(ctx,z.sponsorTop,state.sponsorTop,{min:21,max:43,color:state.accent,weight:750},alerts);
  printBlock(ctx,z.surname,state.surname,{min:24,max:66,color:state.text,weight:850},alerts);
  printBlock(ctx,z.number,normalizeNumber(state.number),{min:180,max:330,color:state.text,weight:900},alerts);
  printBlock(ctx,z.sponsorBottom,state.sponsorBottom,{min:21,max:44,color:state.text,weight:700},alerts);
 }
 if(safeAreas){ctx.save();ctx.strokeStyle='#d2edf9';ctx.lineWidth=3;ctx.setLineDash([12,10]);for(const b of Object.values(z))ctx.strokeRect(b.x,b.y,b.width,b.height);ctx.restore();}
}
function printSurface(side){
 const geom=new THREE.PlaneGeometry(1.34,2.62,36,48);const a=geom.getAttribute('position');
 for(let i=0;i<a.count;i++){const x=a.getX(i);a.setZ(i,-.027*Math.pow(x/.67,2));}
 geom.computeVertexNormals();
 const canvas=createPrintCanvas();const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 tex.anisotropy=8;tex.needsUpdate=true;
 const material=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.FrontSide,alphaTest:.015});
 const mesh=new THREE.Mesh(geom,material);mesh.name=`Impresión ${side}`;mesh.position.set(0,.02,side==='front'?.178:-.178);
 if(side==='back')mesh.rotation.y=Math.PI;
 mesh.renderOrder=5;
 return {mesh,canvas,tex};
}

export async function initViewer(canvas,state,onWarnings){
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.55;
 renderer.shadowMap.enabled=true;
 const scene=new THREE.Scene();
 const camera=new THREE.PerspectiveCamera(32,1,.1,100);camera.position.set(0,0,5.5);
 const ambient=new THREE.HemisphereLight(0xe4f0ff,0x384759,2);scene.add(ambient);
 const key=new THREE.DirectionalLight(0xffffff,3.8);key.position.set(-3,5,5);scene.add(key);
 const fill=new THREE.DirectionalLight(0xb5d4ff,1.4);fill.position.set(3,-1,-3);scene.add(fill);
 const pivot=new THREE.Group();scene.add(pivot);
 let demo=jerseyBody(state);pivot.add(demo.group);
 const printFront=printSurface('front'),printBack=printSurface('back');
 pivot.add(printFront.mesh,printBack.mesh);
 const controls=new OrbitControls(camera,canvas);controls.target.set(0,0,0);controls.enablePan=false;
 controls.minDistance=3.4;controls.maxDistance=8.5;controls.minPolarAngle=.68;controls.maxPolarAngle=2.45;
 controls.enableDamping=true;controls.dampingFactor=.07;controls.update();
 let external=null,disposed=false,safe=false;
 const resize=()=>{const parent=canvas.parentElement,w=Math.max(1,parent.clientWidth),h=Math.max(1,parent.clientHeight);
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
 const observer=new ResizeObserver(resize);observer.observe(canvas.parentElement);resize();
 const frame=()=>{if(disposed)return;controls.update();renderer.render(scene,camera);requestAnimationFrame(frame);};frame();
 const controller={
   update(s){const warnings=[];
    if(demo){demo.fabric.color.set(s.base);demo.accentMat.color.set(s.accent);demo.trimMat.color.set(s.trim);}
    drawPrint(printFront.canvas,'front',s,safe,warnings);drawPrint(printBack.canvas,'back',s,safe,warnings);
    printFront.tex.needsUpdate=true;printBack.tex.needsUpdate=true;onWarnings([...new Set(warnings)]);
   },
   setSafe(value){safe=Boolean(value);this.update(state);},
   view(name){const pos={front:[0,0,5.5],quarter:[3.5,.6,4.3],back:[0,0,-5.5],side:[5.5,0,0]}[name]||[0,0,5.5];
     camera.position.set(...pos);controls.target.set(0,0,0);controls.update();},
   exportPng(){renderer.render(scene,camera);return canvas.toDataURL('image/png');},
   async importModel(buffer){
     if(buffer.byteLength>20*1024*1024)throw new Error('El GLB supera el límite de 20 MB');
     const loader=new GLTFLoader();const gltf=await new Promise((resolve,reject)=>loader.parse(buffer,'',resolve,reject));
     let numMeshes=0,numUV=0;gltf.scene.traverse(o=>{if(o.isMesh){numMeshes++;if(o.geometry?.attributes?.uv)numUV++;}});
     if(!numMeshes)throw new Error('El GLB no contiene geometría de malla');
     const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
     if(!Number.isFinite(size.y)||size.y<=0)throw new Error('Geometría inválida');
     const g=new THREE.Group();g.name='Modelo externo importado';
     gltf.scene.position.sub(center);g.add(gltf.scene);g.scale.setScalar(2.52/size.y);
     if(external)pivot.remove(external);if(demo){pivot.remove(demo.group);demo=null;}
     external=g;pivot.add(g);
     return {meshes:numMeshes,uvMeshes:numUV,warning:'Modelo externo: los marcajes son proyección orientativa; revisar orientación, UV, derecho de uso y zonas reales de impresión.'};
   },
   destroy(){disposed=true;observer.disconnect();controls.dispose();printFront.tex.dispose();printBack.tex.dispose();renderer.dispose();}
 };
 controller.update(state);return controller;
}
