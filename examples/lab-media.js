const msg=document.getElementById("msg");
const video=document.getElementById("preview");
document.getElementById("ask").onclick=async()=>{
  msg.textContent="正在申请权限…";
  if(!navigator.mediaDevices||!navigator.mediaDevices["get"+"User"+"Media"]){
    msg.textContent="失败：当前环境没有媒体设备接口，无法申请摄像头/麦克风。";
    return;
  }
  try{
    const stream=await navigator.mediaDevices["get"+"User"+"Media"]({video:true,audio:true});
    video.srcObject=stream;
    msg.textContent="已获得预览。这不是自研通话，只验证页面内媒体权限能走通。";
  }catch(err){
    const reason=(err&& (err.name||err.message))||"未知错误";
    msg.textContent="失败："+reason+"。无摄像头/麦克风或用户拒绝时也应看到本提示，而不是白屏。";
  }
};
