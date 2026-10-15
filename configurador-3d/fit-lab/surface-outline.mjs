/** Exact plane intersections, shared by frontal/lateral projections.
 * Visit only the slice rows an edge crosses, not every triangle 41 times.
 * Outputs the same 0.1px path as the reference brute-force implementation.
 */
export function surfaceOutlines(meshes,{fullView=false,referenceTop=1.2,slices=40}={}){
 let top=-Infinity,bottom=Infinity;
 for(const m of meshes){const a=m.geometry.attributes.position.array;for(let i=1;i<a.length;i+=3){top=Math.max(top,a[i]);bottom=Math.min(bottom,a[i]);}}
 if(!Number.isFinite(top)||top-bottom<.00002)return {front:'',side:''};
 const first=top-.00001,step=(top-bottom-.00002)/slices,n=slices+1;
 const minX=new Float64Array(n).fill(Infinity),maxX=new Float64Array(n).fill(-Infinity),minZ=minX.slice(),maxZ=maxX.slice();
 for(const m of meshes){const a=m.geometry.attributes.position.array,index=m.geometry.index.array;
  for(let i=0;i<index.length;i+=3)for(let e=0;e<3;e++){
   const u=index[i+e]*3,v=index[i+(e+1)%3]*3,y0=a[u+1],y1=a[v+1],dy=y1-y0;
   if(Math.abs(dy)<1e-9)continue;
   // Expand candidate bounds by one, then use the original exact predicate.
   const begin=Math.max(0,Math.floor((first-Math.max(y0,y1))/step)),end=Math.min(slices,Math.ceil((first-Math.min(y0,y1))/step));
   for(let row=begin;row<=end;row++){
    const y=first-(top-bottom-.00002)*row/slices;if((y-y0)*(y-y1)>0)continue;
    const x=a[u]+(a[v]-a[u])*(y-y0)/dy,z=a[u+2]+(a[v+2]-a[u+2])*(y-y0)/dy;
    minX[row]=Math.min(minX[row],x);maxX[row]=Math.max(maxX[row],x);minZ[row]=Math.min(minZ[row],z);maxZ[row]=Math.max(maxZ[row],z);
   }
  }
 }
 const scale=fullView?22:45;
 const path=(min,max,center)=>{
  const left=[],right=[];for(let row=0;row<n;row++)if(Number.isFinite(min[row])){
   const y=first-(top-bottom-.00002)*row/slices,py=(25+(referenceTop-y)*scale).toFixed(1);
   left.push(`${(center+min[row]*scale).toFixed(1)},${py}`);right.push(`${(center+max[row]*scale).toFixed(1)},${py}`);
  }
  return left.length?'M'+left.join(' L')+' L'+right.reverse().join(' L')+'Z':'';
 };
 return {front:path(minX,maxX,57),side:path(minZ,maxZ,157)};
}
