/**
 * Small, DOM/Three-independent XPBD solver, original implementation.
 * Macklin et al. 2016, eq. 18; fixed substeps, unilateral contact and damping.
 * Relative particle masses / material compliance are NOT textile calibration.
 * No cloth self-collision or continuous triangle collision detection.
 */
export const CLOTH_VERSION='nubyra.xpbd/1.0';
export class ClothSolver {
 constructor({positions,edges,triangles=[],bends=[],seams=[],pins=[],collider,unitMeters=64/242,clearance=.007,compliance=1e-7,initialTranslation=[0,0,0]}){
  if(positions.length%3||positions.some(v=>!Number.isFinite(v)))throw Error('Invalid cloth positions');
  this.triangles=triangles;this.rest=new Float64Array(positions);this.positions=new Float64Array(positions);this.previous=new Float64Array(positions);this.velocity=new Float64Array(positions.length);
  this.weights=new Float64Array(positions.length/3).fill(1);this.pins=pins;this.seams=seams;this.collider=collider;this.clearance=clearance;
  this.gravity=-9.81/unitMeters;this.h=1/240;this.accumulator=0;this.time=0;this.steps=0;this.wind=false;this.maxVelocity=0;
  this.edges=edges.map(([a,b])=>this.constraint(a,b,compliance));
  this.bends=bends.map(([a,b,c])=>this.constraint(a,b,c??.003));
  for(const pin of pins)this.weights[pin.id]=0;
  // Arrange the whole garment at shoulder height before pinning. Rest lengths
  // remain authored; moving only the support vertices creates artificial strain.
  if(initialTranslation.length!==3||initialTranslation.some(v=>!Number.isFinite(v)))throw Error('Invalid initial cloth translation');
  for(let i=0;i<this.positions.length;i++)this.positions[i]+=initialTranslation[i%3];
  this.applyPins();this.projectContacts();this.previous.set(this.positions);
 }
 constraint(a,b,compliance){
  const p=this.rest,i=a*3,j=b*3;return {a,b,length:Math.hypot(p[i]-p[j],p[i+1]-p[j+1],p[i+2]-p[j+2]),compliance,lambda:0};
 }
 applyPins(){for(const pin of this.pins){const k=3*pin.id;for(let a=0;a<3;a++)this.positions[k+a]=pin.position[a];}}
 setCollider(collider,pins=this.pins){this.collider=collider;this.pins=pins;this.applyPins();this.projectContacts();this.velocity.fill(0);}
 projectContacts(){
  if(!this.collider)return;
  const p=this.positions;
  for(let i=0;i<this.weights.length;i++){
   if(!this.weights[i])continue;
   const k=i*3,hit=this.collider.project(p[k],p[k+1],p[k+2],this.clearance);
   if(hit){p[k]=hit[0];p[k+1]=hit[1];p[k+2]=hit[2];}
  }
 }
 projectFaces(){
  if(!this.collider)return;const p=this.positions,w=this.weights;
  for(const tri of this.triangles){
   const [a,b,c]=tri,den=w[a]+w[b]+w[c];if(!den)continue;
   const center=[0,1,2].map(axis=>(p[a*3+axis]+p[b*3+axis]+p[c*3+axis])/3),hit=this.collider.project(...center,this.clearance*.55);
   if(!hit)continue;
   for(const id of tri)for(let axis=0;axis<3;axis++)p[id*3+axis]+=(hit[axis]-center[axis])*3*w[id]/den;
  }
 }
 solveLinks(links){
  const p=this.positions,w=this.weights,h2=this.h*this.h;
  for(const e of links){
   const i=e.a*3,j=e.b*3,dx=p[i]-p[j],dy=p[i+1]-p[j+1],dz=p[i+2]-p[j+2],d=Math.hypot(dx,dy,dz),sum=w[e.a]+w[e.b];
   if(d<1e-9||sum===0)continue;
   const alpha=e.compliance/h2,dl=(-(d-e.length)-alpha*e.lambda)/(sum+alpha);e.lambda+=dl;
   const f=dl/d,wa=w[e.a]*f,wb=w[e.b]*f;
   p[i]+=wa*dx;p[i+1]+=wa*dy;p[i+2]+=wa*dz;p[j]-=wb*dx;p[j+1]-=wb*dy;p[j+2]-=wb*dz;
  }
 }
 solveSeams(){
  const p=this.positions,w=this.weights;
  for(const {s,a,b,t} of this.seams){
   const u=1-t,den=w[s]+w[a]*u*u+w[b]*t*t;if(!den)continue;
   for(let axis=0;axis<3;axis++){
    const c=p[s*3+axis]-u*p[a*3+axis]-t*p[b*3+axis],dl=-c/den;
    p[s*3+axis]+=w[s]*dl;p[a*3+axis]-=w[a]*u*dl;p[b*3+axis]-=w[b]*t*dl;
   }
  }
 }
 substep(){
  const p=this.positions,h=this.h,drag=Math.exp(-3.5*h);this.previous.set(p);
  const gust=this.wind?2.8*Math.sin(this.time*2.1)+1.1*Math.sin(this.time*4.7):0;
  for(let i=0;i<this.weights.length;i++){
   if(!this.weights[i])continue;const k=i*3;
   this.velocity[k]*=drag;this.velocity[k+1]=(this.velocity[k+1]+this.gravity*h)*drag;
   // Free hem flutters, while the shoulder band carries less wind load.
   const freedom=Math.max(.08,Math.min(1,(1.2-this.rest[k+1])/2.4));
   this.velocity[k+2]=(this.velocity[k+2]+gust*freedom*h)*drag;
   p[k]+=this.velocity[k]*h;p[k+1]+=this.velocity[k+1]*h;p[k+2]+=this.velocity[k+2]*h;
  }
  for(const e of this.edges)e.lambda=0;for(const e of this.bends)e.lambda=0;
  for(let iteration=0;iteration<3;iteration++){this.solveLinks(this.edges);this.solveLinks(this.bends);this.solveSeams();this.applyPins();this.projectContacts();}
  this.projectFaces();this.solveSeams();this.projectContacts();
  let max=0;
  for(let i=0;i<p.length;i++){
   const v=(p[i]-this.previous[i])/h;this.velocity[i]=Math.max(-12,Math.min(12,v));max=Math.max(max,Math.abs(this.velocity[i]));
   if(!Number.isFinite(p[i]))throw Error('Non-finite cloth solution');
  }
  this.time+=h;this.steps++;this.maxVelocity=max;
 }
 advance(seconds){
  if(!Number.isFinite(seconds)||seconds<=0)return;
  this.accumulator+=Math.min(seconds,1/30);let count=0;
  while(this.accumulator>=this.h&&count++<8){this.substep();this.accumulator-=this.h;}
 }
 settle(frames=90){const wind=this.wind;this.wind=false;for(let i=0;i<frames*4;i++)this.substep();this.velocity.fill(0);this.maxVelocity=0;this.wind=wind;}
 impulse(strength=.7){for(let i=0;i<this.weights.length;i++){const k=i*3;if(this.weights[i])this.velocity[k+2]+=strength*Math.max(0,Math.min(1,(.2-this.positions[k+1])/1.3));}}
 diagnostics(){
  const p=this.positions,strain=[];let maxPenetration=0,contacts=0,gapSum=0,samples=0,pinError=0,meanDrop=0;
  for(const e of this.edges){const a=e.a*3,b=e.b*3;strain.push(Math.abs(Math.hypot(p[a]-p[b],p[a+1]-p[b+1],p[a+2]-p[b+2])/e.length-1));}
  for(let i=0;i<this.weights.length;i++){
   const k=i*3,gap=this.collider?.gap(p[k],p[k+1],p[k+2]);meanDrop+=this.rest[k+1]-p[k+1];
   if(Number.isFinite(gap)){maxPenetration=Math.max(maxPenetration,-gap);if(gap<this.clearance*2)contacts++;gapSum+=Math.max(0,gap);samples++;}
  }
  for(const pin of this.pins)for(let j=0;j<3;j++)pinError=Math.max(pinError,Math.abs(p[pin.id*3+j]-pin.position[j]));
  let maxTrianglePenetration=0;
  for(const tri of this.triangles){const center=[0,1,2].map(axis=>tri.reduce((sum,id)=>sum+p[id*3+axis],0)/3);const gap=this.collider?.gap(...center);if(Number.isFinite(gap))maxTrianglePenetration=Math.max(maxTrianglePenetration,-gap);}
  strain.sort((a,b)=>a-b);
  return {version:CLOTH_VERSION,particles:this.weights.length,stretchConstraints:this.edges.length,bendingConstraints:this.bends.length,seams:this.seams.length,pins:this.pins.length,steps:this.steps,simulationTime:this.time,gravity:this.gravity,fixedStep:this.h,maxPenetrationUnits:maxPenetration,maxTrianglePenetrationUnits:maxTrianglePenetration,contactVertices:contacts,meanGapUnits:samples?gapSum/samples:0,p95Strain:strain[Math.floor(strain.length*.95)]??0,maxStrain:strain.at(-1)??0,pinErrorUnits:pinError,meanDropUnits:meanDrop/this.weights.length,maxVelocity:this.maxVelocity,materialCalibrated:false,selfCollision:false};
 }
}
