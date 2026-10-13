/**
 * NUBYRA · malla deportiva femenina de ENSAYO v2.
 * Geometría original del proyecto. No es un patrón industrial ni una talla.
 *
 * Topología: retícula regular a ambos lados del escote (frente/espalda),
 * perfil lateral curvo, UV continuas por panel y normales analíticas.
 * Los marcajes se mantienen desacoplados en el atlas del configurador.
 */
export const TEST_JERSEY_META=Object.freeze({
  id:'nubyra-free-sleeveless-v2',
  author:'NUBYRA · prototipo original',
  license:'NUBYRA-internal-test',
  garment:'Camiseta deportiva femenina sin mangas',
  industrial:false,
  independentFromClothingAxis:true,
  topology:'structured-panel-grid-v2'
});

export const GRID=Object.freeze({
  bottom:-1.22, shoulderTop:1.20, shoulderDrop:.11, underarm:.39,
  panelRows:48, halfPanelCols:15, sideRows:28, sideCols:10,
  trimRadialSegments:6
});

// Semiancho del torso desde el bajo hasta el hombro; valores en unidades 3D
// visuales, NO centímetros de patronaje. La curva evita ángulos en la cintura.
const WIDTH_PROFILE=Object.freeze([
  [-1.22,.620],[-.98,.612],[-.64,.554],[-.28,.502],
  [.02,.528],[.30,.612],[.39,.627],[.55,.567],
  [.78,.502],[1.09,.485],[1.20,.476]
]);
const clamp01=v=>Math.max(0,Math.min(1,v));
const gauss=v=>Math.exp(-v*v);
const lerp=(a,b,t)=>a+(b-a)*t;

export function torsoHalfWidth(y){
  if(y<=WIDTH_PROFILE[0][0])return WIDTH_PROFILE[0][1];
  const n=WIDTH_PROFILE.length;
  if(y>=WIDTH_PROFILE[n-1][0])return WIDTH_PROFILE[n-1][1];
  for(let i=0;i<n-1;i++){
    const a=WIDTH_PROFILE[i],b=WIDTH_PROFILE[i+1];
    if(y>b[0])continue;
    const range=b[0]-a[0],t=clamp01((y-a[0])/range);
    const prev=WIDTH_PROFILE[Math.max(i-1,0)];
    const next=WIDTH_PROFILE[Math.min(i+2,n-1)];
    const m0=(b[1]-prev[1])/(b[0]-prev[0]);
    const m1=(next[1]-a[1])/(next[0]-a[0]);
    const t2=t*t,t3=t2*t;
    return (2*t3-3*t2+1)*a[1]+(t3-2*t2+t)*range*m0+
      (-2*t3+3*t2)*b[1]+(t3-t2)*range*m1;
  }
  return WIDTH_PROFILE[n-1][1];
}

function upperY(u){
  return GRID.shoulderTop-GRID.shoulderDrop*Math.pow(clamp01(u),1.28);
}
function neckHalfWidth(y,front){
  const tip=front?.91:1.055, span=GRID.shoulderTop-tip;
  const t=clamp01((y-tip)/span);
  return (front?.225:.235)*Math.pow(t,front?.92:.52);
}
export function torsoDepth(x,y,front=true){
  // Volumen pectoral suave, sin picos en centro o costuras laterales.
  const round=.113*gauss(x/.56);
  const bust=.064*gauss((y-.25)/.35)*gauss(x/.44);
  const lower=.016*gauss((y+.82)/.42);
  if(front)return .134+round+bust+lower;
  return -.131-.085*gauss(x/.62)-.028*gauss((y+.22)/.70);
}
function analyticalNormal(x,y,front){
  const d=.00075;
  const dx=(torsoDepth(x+d,y,front)-torsoDepth(x-d,y,front))/(2*d);
  const dy=(torsoDepth(x,y+d,front)-torsoDepth(x,y-d,front))/(2*d);
  const nx=front?-dx:dx,ny=front?-dy:dy,nz=front?1:-1;
  const inv=1/Math.hypot(nx,ny,nz);
  return [nx*inv,ny*inv,nz*inv];
}
function panelGeometry(T,front){
  const positions=[],normals=[],uv=[],indices=[];
  const rows=GRID.panelRows,cols=GRID.halfPanelCols;
  for(const side of [-1,1]){
    const start=positions.length/3;
    for(let row=0;row<=rows;row++){
      const v=row/rows;
      for(let col=0;col<=cols;col++){
        const u=col/cols;
        const y=lerp(GRID.bottom,upperY(u),v);
        const inner=neckHalfWidth(y,front),outer=torsoHalfWidth(y);
        const x=side*lerp(inner,outer,u);
        const z=torsoDepth(x,y,front);
        positions.push(x,y,z);
        normals.push(...analyticalNormal(x,y,front));
        const textureU=front?.5*(x+.68)/1.36:.5+.5*(.68-x)/1.36;
        uv.push(clamp01(textureU),clamp01((y-GRID.bottom)/(GRID.shoulderTop-GRID.bottom)));
      }
    }
    for(let row=0;row<rows;row++){
      for(let col=0;col<cols;col++){
        const a=start+row*(cols+1)+col,b=a+cols+1;
        const faceRight=side===1;
        if(front===faceRight){
          indices.push(a,a+1,b,a+1,b+1,b);
        }else{
          indices.push(a,b,a+1,a+1,b,b+1);
        }
      }
    }
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  g.setIndex(indices);
  g.userData={part:front?'front':'back',gridRows:rows,halfColumns:cols};
  return g;
}
function sideGeometry(T,side){
  const positions=[],uv=[],indices=[],rows=GRID.sideRows,cols=GRID.sideCols;
  for(let row=0;row<=rows;row++){
    const y=lerp(GRID.bottom,GRID.underarm,row/rows);
    const x=side*torsoHalfWidth(y);
    for(let col=0;col<=cols;col++){
      const t=col/cols;
      const z=lerp(torsoDepth(x,y,true),torsoDepth(x,y,false),t);
      positions.push(x,y,z);uv.push(t,row/rows);
    }
  }
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const a=row*(cols+1)+col,b=a+cols+1;
    indices.push(a,a+1,b,a+1,b+1,b);
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  g.setIndex(indices);g.computeVertexNormals();
  return g;
}
function trim(T,coordinates,front,material,name,radius=.015){
  const points=coordinates.map(([x,y])=>
    new T.Vector3(x,y,torsoDepth(x,y,front)+(front?.008:-.008)));
  const spline=new T.CatmullRomCurve3(points,false,'centripetal');
  const geometry=new T.TubeGeometry(spline,Math.max(18,coordinates.length*2),
    radius,GRID.trimRadialSegments,false);
  const mesh=new T.Mesh(geometry,material);
  mesh.name=name;
  return mesh;
}
function neckCoordinates(front){
  const from=front?.91:1.055,steps=18,points=[];
  for(let i=0;i<=steps;i++){
    const y=lerp(GRID.shoulderTop,from,i/steps);
    points.push([-neckHalfWidth(y,front),y]);
  }
  for(let i=1;i<=steps;i++){
    const y=lerp(from,GRID.shoulderTop,i/steps);
    points.push([neckHalfWidth(y,front),y]);
  }
  return points;
}
function armholeCoordinates(side){
  return Array.from({length:23},(_,i)=>{
    const y=lerp(GRID.underarm,GRID.shoulderTop-GRID.shoulderDrop,i/22);
    return [side*torsoHalfWidth(y),y];
  });
}
function hemCoordinates(){
  return Array.from({length:17},(_,i)=>[lerp(-torsoHalfWidth(GRID.bottom),
    torsoHalfWidth(GRID.bottom),i/16),GRID.bottom]);
}
export function createFreeTestJersey(T){
  if(!T?.BufferGeometry||!T?.ShapeGeometry||!T?.Group){
    throw new Error('Se necesita Three.js para generar el modelo de prueba');
  }
  const group=new T.Group();
  group.name='NUBYRA_Test_Free_Sleeveless';
  group.userData={...TEST_JERSEY_META};
  const blue=new T.MeshStandardMaterial({color:0x102d50,roughness:.91,metalness:0,side:T.DoubleSide});
  const yellow=new T.MeshStandardMaterial({color:0xf8c12e,roughness:.87,side:T.DoubleSide});
  const ivory=new T.MeshStandardMaterial({color:0xfbf6e8,roughness:.86,side:T.DoubleSide});
  for(const front of [true,false]){
    const mesh=new T.Mesh(panelGeometry(T,front),blue);
    mesh.name=front?'NUBYRA_Test_Jersey_Front':'NUBYRA_Test_Jersey_Back';
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  for(const side of [-1,1]){
    const mesh=new T.Mesh(sideGeometry(T,side),yellow);
    mesh.name=side<0?'NUBYRA_Test_Side_Left':'NUBYRA_Test_Side_Right';
    group.add(mesh);
  }
  for(const front of [true,false]){
    group.add(trim(T,neckCoordinates(front),front,yellow,
      front?'trim-front-neck':'trim-back-neck',.018));
    for(const side of [-1,1]){
      group.add(trim(T,armholeCoordinates(side),front,yellow,
        'trim-'+(front?'front':'back')+'-armhole-'+(side<0?'left':'right'),.015));
    }
    group.add(trim(T,hemCoordinates(),front,ivory,
      front?'trim-front-hem':'trim-back-hem',.009));
  }
  return group;
}
