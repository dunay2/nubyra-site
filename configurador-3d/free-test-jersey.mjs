/**
 * NUBYRA · camiseta de ensayo SIN DESCARGAS ni assets comerciales.
 * Geometría original NUBYRA, generada en Three.js. Derechos reservados. No es patrón industrial.
 * La construcción femenina es estilización visual; no expresa tallas reales.
 */
export const TEST_JERSEY_META=Object.freeze({
  id:'nubyra-free-sleeveless-v1',
  author:'NUBYRA · prototipo original', license:'NUBYRA-internal-test',
  garment:'Camiseta deportiva femenina sin mangas',
  industrial:false, independentFromClothingAxis:true
});
const torsoHalfWidth=y=>{
  const points=[[-1.20,.59],[-.85,.55],[-.30,.50],[.24,.57],[.38,.64],[.58,.53]];
  if(y<=points[0][0])return points[0][1];
  for(let i=1;i<points.length;i++){
    if(y<=points[i][0]){
      const a=points[i-1],b=points[i],t=(y-a[0])/(b[0]-a[0]);
      return a[1]+(b[1]-a[1])*t;
    }
  }
  return .53;
};
const depthAt=(x,y,front)=>{
  const bulge=Math.pow(Math.max(.06,1-(x/.82)**2),.72);
  return front ? .14+(.15+.05*Math.exp(-Math.pow((y-.43)/.4,2)))*bulge:
    -.13-(.11+.02*Math.exp(-Math.pow((y+.14)/.5,2)))*bulge;
};
function outline(T,front){
  const s=new T.Shape();s.moveTo(-.59,-1.20);
  s.lineTo(.59,-1.20);
  s.bezierCurveTo(.57,-.93,.49,-.50,.50,-.30);
  s.bezierCurveTo(.52,-.05,.66,.27,.64,.38);
  s.bezierCurveTo(.50,.60,.44,.88,.49,1.10);
  s.lineTo(.32,1.22);s.lineTo(.215,1.19);
  if(front){s.quadraticCurveTo(.105,1.07,0,.95);s.quadraticCurveTo(-.105,1.07,-.215,1.19);}
  else {s.quadraticCurveTo(0,1.075,-.215,1.19);}
  s.lineTo(-.32,1.22);s.lineTo(-.49,1.10);
  s.bezierCurveTo(-.44,.88,-.50,.60,-.64,.38);
  s.bezierCurveTo(-.66,.27,-.52,-.05,-.50,-.30);
  s.bezierCurveTo(-.49,-.50,-.57,-.93,-.59,-1.20);
  return s;
}
function panel(T,front){
  const g=new T.ShapeGeometry(outline(T,front),40);
  const p=g.getAttribute('position'),uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i);
    p.setZ(i,depthAt(x,y,front));
    uv[i*2]=front? .5*(x+.69)/1.38 : .5+.5*(.69-x)/1.38;
    uv[i*2+1]=(y+1.21)/2.46;
  }
  p.needsUpdate=true;g.setAttribute('uv',new T.BufferAttribute(uv,2));g.computeVertexNormals();
  return g;
}
function side(T,sign){
  const rows=24,cols=12,verts=[],uv=[],ind=[];
  for(let y=0;y<=rows;y++){
    const yy=-1.2+1.79*y/rows,x=sign*torsoHalfWidth(yy);
    for(let c=0;c<=cols;c++){
      const v=c/cols,z=depthAt(x,yy,true)*(1-v)+depthAt(x,yy,false)*v;
      verts.push(x,yy,z);uv.push(v,y/rows);
      if(y&&c){const a=(y-1)*(cols+1)+c-1,b=a+cols+1;ind.push(a,b,a+1,a+1,b,b+1);}
    }
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));
  geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geo.setIndex(ind);geo.computeVertexNormals();return geo;
}
function strip(T,points,front,color,name,radius=.018){
  const positions=points.map(([x,y])=>new T.Vector3(x,y,depthAt(x,y,front)+(front?.012:-.012)));
  const curve=new T.CatmullRomCurve3(positions,false,'centripetal');
  const g=new T.TubeGeometry(curve,Math.max(10,points.length*8),radius,7,false);
  const m=new T.Mesh(g,color);m.name=name;return m;
}
export function createFreeTestJersey(T){
  if(!T?.ShapeGeometry||!T?.Group)throw Error('Se necesita Three.js para generar el modelo de prueba');
  const group=new T.Group();
  group.name='NUBYRA_Test_Free_Sleeveless';
  group.userData={...TEST_JERSEY_META};
  const blue=new T.MeshStandardMaterial({color:0x102d50,roughness:.94,metalness:0,side:T.DoubleSide});
  const yellow=new T.MeshStandardMaterial({color:0xf8c12e,roughness:.85,side:T.DoubleSide});
  const ivory=new T.MeshStandardMaterial({color:0xfbf6e8,roughness:.84,side:T.DoubleSide});
  for(const front of [true,false]){
    const mesh=new T.Mesh(panel(T,front),blue);
    mesh.name=front?'NUBYRA_Test_Jersey_Front':'NUBYRA_Test_Jersey_Back';
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  for(const sign of [-1,1]){
    const mesh=new T.Mesh(side(T,sign),yellow);
    mesh.name=sign<0?'NUBYRA_Test_Side_Left':'NUBYRA_Test_Side_Right';
    group.add(mesh);
  }
  const neckFront=[[-.215,1.19],[-.12,1.083],[0,.95],[.12,1.083],[.215,1.19]];
  const neckBack=[[-.215,1.19],[0,1.12],[.215,1.19]];
  group.add(strip(T,neckFront,true,yellow,'trim-front-neck'));
  group.add(strip(T,neckBack,false,yellow,'trim-back-neck'));
  for(const front of [true,false])for(const sign of [-1,1]){
    const path=[[.49,1.10],[.46,.89],[.50,.64],[.59,.43],[.64,.38]]
      .map(([x,y])=>[sign*x,y]);
    group.add(strip(T,path,front,yellow,
      'trim-'+(front?'front':'back')+'-armhole-'+(sign<0?'left':'right'),.015));
  }
  group.add(strip(T,[[-.59,-1.185],[0,-1.205],[.59,-1.185]],true,ivory,'trim-front-hem',.010));
  group.add(strip(T,[[-.59,-1.185],[0,-1.205],[.59,-1.185]],false,ivory,'trim-back-hem',.010));
  return group;
}
