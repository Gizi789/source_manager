const fs=require("fs");
const path=require("path");
const onlineFix={type:"ini-set",glob:"OnlineFix.ini",section:"Hashes",key:"1337",value:"defa34f9d4e76c16eeb47f057f337934d4e47da373fd5dced397e2db05370865c9a75a0314d14d7fc15f1da4cab85f769ea958825210af06be6c4e253abeaf73"};
function validate(value){
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("El perfil debe ser un objeto.");
 const archivePasswords=value.archivePasswords||[],beforePlay=value.beforePlay||[];
 if(!Array.isArray(archivePasswords)||archivePasswords.length>5000||archivePasswords.some(p=>typeof p!=="string"||p.length>1024))throw Error("Contraseñas de perfil inválidas.");
 if(!Array.isArray(beforePlay)||beforePlay.length>32||beforePlay.some(s=>!s||!["ini-set","run"].includes(s.type)))throw Error("Pasos de perfil inválidos.");
 return {...value,version:1,archivePasswords:[...new Set(archivePasswords)],beforePlay};
}
function createProfiles(filename,log=console){
 let previous={default:{version:1,id:"provider-default",name:"Preparación del proveedor",archivePasswords:[],beforePlay:[onlineFix]},sources:{},games:{}},stamp="";
 const read=()=>{
  try{const stat=fs.statSync(filename),next=String(stat.mtimeMs);if(next!==stamp){const incoming=JSON.parse(fs.readFileSync(filename,"utf8").replace(/^\uFEFF/,""));if(incoming.default)validate(incoming.default);for(const value of Object.values(incoming.sources||{}))validate(value);for(const value of Object.values(incoming.games||{}))validate(value);previous=incoming;stamp=next;log.info("[Profiles] Configuration updated; secrets remain local to plugin.");}}
  catch(err){if(err.code!=="ENOENT")log.warn("[Profiles] Invalid update ignored; last valid configuration retained.");}
  return previous;
 };
 return {revision(){read();return stamp||"0";},forGame(appId,sourceName=""){const data=read();return validate(data.games?.[String(appId)]??data.sources?.[sourceName]??data.default??{archivePasswords:[],beforePlay:[]});}};
}
module.exports={createProfiles,validate,onlineFix};

