const {createProfiles,validate}=require("./execution-profiles");
const fs=require("fs"),os=require("os"),path=require("path");
test("loads dynamic profiles and retains last good update",()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),"ga-profiles-"));
 const file=path.join(folder,"execution-profiles.json");
 fs.writeFileSync(file,JSON.stringify({default:{archivePasswords:["fixture"],beforePlay:[]},games:{"10":{archivePasswords:["specific"],beforePlay:[]}}}));
 const profiles=createProfiles(file,{info(){},warn(){}});
 expect(profiles.forGame(10).archivePasswords).toEqual(["specific"]);
 expect(profiles.forGame(11).archivePasswords).toEqual(["fixture"]);
 fs.writeFileSync(file,"invalid");
 expect(profiles.forGame(11).archivePasswords).toEqual(["fixture"]);
 fs.rmSync(folder,{recursive:true,force:true});
});
test("rejects executable shell logic and invalid password lists",()=>{
 expect(()=>validate({beforePlay:[{type:"shell"}]})).toThrow();
 expect(()=>validate({archivePasswords:[123]})).toThrow();
});

