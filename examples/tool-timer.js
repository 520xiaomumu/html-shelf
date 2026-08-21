let n=0,run=true,t=setInterval(()=>{if(run){n+=1;document.getElementById("sec").textContent=String(n);}},1000);
document.getElementById("toggle").onclick=()=>{run=!run;document.getElementById("toggle").textContent=run?"暂停":"继续";};
document.getElementById("reset").onclick=()=>{n=0;document.getElementById("sec").textContent="0";};
const note=document.getElementById("note");
note.value=localStorage.getItem("note")||"";
note.addEventListener("input",()=>localStorage.setItem("note",note.value));
