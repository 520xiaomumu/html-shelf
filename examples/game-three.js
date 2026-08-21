const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
let cells,turn,over;
function start(){cells=Array(9).fill("");turn="○";over=false;const b=document.getElementById("board");b.innerHTML="";
for(let i=0;i<9;i++){const btn=document.createElement("button");btn.type="button";btn.onclick=()=>play(i,btn);b.appendChild(btn);}
document.getElementById("msg").textContent="轮到 ○";}
function play(i,btn){if(over||cells[i])return;cells[i]=turn;btn.textContent=turn;
if(wins.some(w=>w.every(j=>cells[j]===turn))){document.getElementById("msg").textContent=turn+" 胜";over=true;return;}
if(cells.every(Boolean)){document.getElementById("msg").textContent="平局";over=true;return;}
turn=turn==="○"?"×":"○";document.getElementById("msg").textContent="轮到 "+turn;}
document.getElementById("again").onclick=start;start();
