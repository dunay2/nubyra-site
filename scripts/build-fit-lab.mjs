import {build} from 'esbuild';
import {mkdir,readFile,writeFile,copyFile,rm} from 'node:fs/promises';
const out='fit-dist';await rm(out,{recursive:true,force:true});await mkdir(out+'/fit-lab',{recursive:true});
await build({entryPoints:['configurador-3d/fit-lab/app.mjs'],bundle:true,format:'esm',target:'es2022',minify:true,splitting:false,outfile:out+'/fit-lab/app.mjs',metafile:true}).then(async result=>writeFile(out+'/build-meta.json',JSON.stringify(result.metafile)));
const html=(await readFile('configurador-3d/fit-lab/index.html','utf8')).replace(/<script type="importmap">[\s\S]*?<\/script>/,'');await writeFile(out+'/fit-lab/index.html',html);await copyFile('configurador-3d/fit-lab/styles.css',out+'/fit-lab/styles.css');
await writeFile(out+'/index.html','<!doctype html><html lang="es"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/fit-lab/"><title>NUBYRA Fit Lab</title><a href="/fit-lab/">Abrir Fit Lab</a></html>');
