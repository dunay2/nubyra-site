/** Publication is verified by its commit, never by a successful local build. */
export async function mountReleaseIdentity({fetcher=globalThis.fetch,root=globalThis.document}={}) {
 const label=root?.getElementById('build-label');if(!label)return null;
 try {
  const response=await fetcher(new URL('../release.json',import.meta.url),{cache:'no-store'});
  if(!response.ok)throw Error('Release not available');
  const release=await response.json();
  if(!/^[a-f0-9]{40}$/i.test(release.commit||''))throw Error('Unverified build');
  label.textContent='Lab · '+release.commit.slice(0,7);
  label.title=`Commit ${release.commit} · ${release.faceVersion||'rostro sin versión'}`;
  label.dataset.commit=release.commit;label.dataset.faceVersion=release.faceVersion||'';
  return release;
 }catch{
  label.textContent='Lab · versión no verificada';label.removeAttribute('data-commit');return null;
 }
}
if(typeof document!=='undefined')void mountReleaseIdentity();
