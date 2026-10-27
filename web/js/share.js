// Share card image + 6-second video. Loaded after the first reading.
import { TIERS, words } from "./score.js";
import { $, SITE, S, isPro, charSVG, track } from "./core.js";

/* ---------- share card ---------- */
const CARD={w:1080,h:1920};
const TC=["#3D8BFF","#22C29B","#A9A2DA","#FF8A3D","#A8C42E"];
const TEXT_ON=["#FFFFFF","#1F2340","#1F2340","#1F2340","#1F2340"];
const CAPS=["Rated WICKED on the Wackometer. Your move.","Wackometer says WELL PUT. I'll take it.","Wackometer said WHATEVER. Rude, but fair?","Wackometer called this WEIRD. Is it?","My verse got rated WACK 🤢 Be honest, is it?"];
let cardBlob=null,cardLinesTouched=false,cardImg=null;
function defaultLines(){if(!S.last)return "";
  if(S.last.best)return S.last.best.line;
  const r=S.last.real.filter(l=>words(l).length>2&&!/^(oh|ooh|yeah|na|la)\b/i.test(l));return r.slice(0,2).join("\n")}
function wrap(ctx,text,maxW){const out=[];text.split("\n").forEach(par=>{let line="";par.split(/\s+/).forEach(w=>{const t=line?line+" "+w:w;if(ctx.measureText(t).width>maxW&&line){out.push(line);line=w}else line=t});if(line)out.push(line)});return out}
const ease=(t)=>1-Math.pow(1-t,3), back=(t)=>{const c=1.9;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)};
// p: animation progress 0..1 (1 = finished card). Needle sweeps, character pops, verdict stamps.
function paintCard(x,p){
  const t=S.last.tier,col=TC[t],D='"Fredoka",system-ui,sans-serif',B='system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
  const pn=Math.min(1,p/0.55), pc=Math.max(0,Math.min(1,(p-0.45)/0.3)), pv=Math.max(0,Math.min(1,(p-0.62)/0.25)), pl=Math.max(0,Math.min(1,(p-0.8)/0.2));
  x.save();x.textAlign="left";x.fillStyle="#FBFCFF";x.fillRect(0,0,CARD.w,CARD.h);
  x.fillStyle=t>=3?"#EAF3C4":"#E8F1FF";x.fillRect(0,0,CARD.w,560);
  if(t>=3){for(let i=0;i<9;i++){const dx=60+i*120+(i%2)*30,len=(60+((i*53)%140))*ease(pv);x.beginPath();x.moveTo(dx-26,560);x.lineTo(dx+26,560);x.lineTo(dx+14,560+len);x.arc(dx,560+len,14,0,Math.PI);x.closePath();x.fill()}}
  x.fillStyle="#1F2340";x.font=`700 88px ${D}`;x.textBaseline="alphabetic";
  const wW=x.measureText("W").width,rest="ackometer",rW=x.measureText(rest).width,sx=(CARD.w-wW-rW)/2;
  x.save();x.translate(sx+wW/2,200);x.rotate(-.14);x.fillStyle="#86A01A";x.fillText("W",-wW/2,0);x.restore();x.fillText(rest,sx+wW,200);
  x.font=`600 40px ${B}`;x.fillStyle="#646A8C";x.textAlign="center";x.fillText(($("postTitle").value.trim()?`"${$("postTitle").value.trim()}" `:"My lyrics ")+"got weighed",CARD.w/2,330);
  const gx=CARD.w/2,gy=1020,gr=390;
  for(let i=0;i<5;i++){x.beginPath();x.strokeStyle=TC[i];x.lineWidth=70;const a0=Math.PI+(i*20+(i?1:0))/100*Math.PI,a1=Math.PI+((i+1)*20-(i<4?1:0))/100*Math.PI;x.arc(gx,gy,gr,a0,a1);x.stroke()}
  x.font=`600 30px ${B}`;x.fillStyle="#646A8C";["Wicked","Well put","Whatever","Weird","Wack"].forEach((n,i)=>{const a=Math.PI+(i*20+10)/100*Math.PI;x.fillText(n,gx+(gr+80)*Math.cos(a),gy+(gr+80)*Math.sin(a)+10)});
  const shown=S.last.score*back(pn);const na=Math.PI+Math.max(0,Math.min(104,shown))/100*Math.PI;
  x.strokeStyle="#1F2340";x.lineWidth=14;x.lineCap="round";x.beginPath();x.moveTo(gx,gy);x.lineTo(gx+(gr-60)*Math.cos(na),gy+(gr-60)*Math.sin(na));x.stroke();
  x.fillStyle="#1F2340";x.beginPath();x.arc(gx,gy,34,0,7);x.fill();x.fillStyle="#FBFCFF";x.beginPath();x.arc(gx,gy,12,0,7);x.fill();
  if(cardImg&&pc>0){const s=250*back(pc);x.save();x.translate(221,gy+310);x.drawImage(cardImg,-s/2,-s,s,s);x.restore()}
  x.fillStyle="#1F2340";x.font=`700 230px ${D}`;x.fillText(String(Math.round(Math.min(S.last.score,Math.max(0,shown)))),gx+60,gy+250);
  if(pv>0){x.save();x.globalAlpha=Math.min(1,pv*2);const sc=1+(1-back(pv))*0.6;x.translate(gx,gy+365);x.scale(sc,sc);
    x.font=`700 96px ${D}`;const vt=TIERS[t].n.toUpperCase(),vw=x.measureText(vt).width+90;x.rotate(-0.04);
    x.fillStyle=col;x.beginPath();x.roundRect(-vw/2,-65,vw,130,65);x.fill();x.fillStyle=TEXT_ON[t];x.fillText(vt,0,33);x.restore()}
  const lines=$("cardLines").value.trim();
  if(lines&&pl>0){x.save();x.globalAlpha=pl;x.font=`italic 400 46px ${B}`;const ws=wrap(x,lines,CARD.w-200).slice(0,5);const top=1560-((ws.length-1)*64)/2+20;
    x.fillStyle=S.last.best&&lines===S.last.best.line?"#FFD84D":"#A8C42E";x.fillRect(90,top-50,8,ws.length*64);x.fillStyle="#1F2340";x.textAlign="left";ws.forEach((l,i)=>x.fillText(l,130,top+i*64));
    if(S.last.best&&lines===S.last.best.line){x.font=`700 30px ${D}`;x.fillStyle="#B98A00";x.fillText("⭐ Wiz's pick",130,top-70)}
    x.restore();x.textAlign="center"}
  x.font=`600 38px ${B}`;x.fillStyle="#646A8C";x.fillText("Is yours wack? Weigh it at "+SITE,gx,1840);
  if(!isPro()){x.save();x.globalAlpha=.5;x.font=`600 26px ${B}`;x.fillText("free plan",gx,1885);x.restore()}
  x.restore();
}
async function loadCardAssets(){
  try{await document.fonts.load('700 100px "Fredoka"')}catch(e){}
  cardImg=await new Promise(res=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>res(null);im.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(charSVG(S.last.tier,400))});
}
export async function drawCard(){
  if(!S.last){$("share").hidden=true;return}
  $("share").hidden=false;
  if(!cardLinesTouched)$("cardLines").value=defaultLines();
  await loadCardAssets();
  const c=document.createElement("canvas");c.width=CARD.w;c.height=CARD.h;paintCard(c.getContext("2d"),1);
  $("cardImg").src=c.toDataURL("image/png");
  cardBlob=await new Promise(r=>c.toBlob(r,"image/png"));
  $("cap").textContent=CAPS[S.last.tier]+" #wackometer #songwriting #lyrics";
}
$("cardLines").addEventListener("input",()=>{cardLinesTouched=true;clearTimeout(drawCard._t);drawCard._t=setTimeout(drawCard,250)});
$("postTitle").addEventListener("input",()=>{clearTimeout(drawCard._t);drawCard._t=setTimeout(drawCard,250)});

async function cardFile() { return new File([cardBlob], `wackometer-${TIERS[S.last.tier].n.toLowerCase().replace(/\s/g, "-")}-${S.last.score}.png`, { type: "image/png" }); }
function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
$("saveCard").onclick = async () => { if (!cardBlob) return; const f = await cardFile(); download(f, f.name); $("cardNote").textContent = "Saved to your downloads."; track("save_card"); };
$("shareCard").onclick = async () => {
  if (!cardBlob) return; const f = await cardFile(), text = $("cap").textContent; track("share_card");
  if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], text }); } catch (e) {} }
  else { $("cardNote").textContent = "Sharing straight to apps works on phones. Save the image and post it from there."; }
};
// 6-second vertical clip: needle swings, character pops, verdict stamps, then holds.
$("saveVideo").onclick = async () => {
  const btn = $("saveVideo"), note = $("cardNote");
  const types = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
  const type = window.MediaRecorder && types.find((t) => MediaRecorder.isTypeSupported(t));
  if (!type) { note.textContent = "This browser can't record video. Try Chrome or Safari, or save the image."; return; }
  btn.disabled = true; btn.textContent = "🎬 Recording…"; await loadCardAssets();
  const c = document.createElement("canvas"); c.width = 720; c.height = 1280; const x = c.getContext("2d");
  const stream = c.captureStream(30), rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 5_000_000 }), chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((r) => (rec.onstop = r));
  rec.start(250); const t0 = performance.now(), dur = 6000;
  await new Promise((resolve) => { (function frame() {
    const el = performance.now() - t0, p = Math.min(1, el / 3200);
    x.setTransform(720 / CARD.w, 0, 0, 1280 / CARD.h, 0, 0); paintCard(x, p);
    if (el < dur) requestAnimationFrame(frame); else resolve();
  })(); });
  rec.stop(); await done;
  const ext = type.includes("mp4") ? "mp4" : "webm", blob = new Blob(chunks, { type: type.split(";")[0] });
  const name = `wackometer-${TIERS[S.last.tier].n.toLowerCase().replace(/\s/g, "-")}-${S.last.score}.${ext}`;
  const f = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], text: $("cap").textContent }); } catch (e) { download(f, name); } }
  else download(f, name);
  note.textContent = ext === "mp4" ? "Video saved. Post it to TikTok, Reels or Stories." : "Video saved as .webm. TikTok and Instagram take it on desktop; on iPhone, use Safari for .mp4.";
  btn.disabled = false; btn.textContent = "🎬 Save video"; track("save_video");
};
$("copyCap").onclick=async()=>{track("copy_caption");const t=$("cap").textContent;try{await navigator.clipboard.writeText(t);$("copyCap").textContent="Copied"}catch(e){const r=document.createRange();r.selectNodeContents($("cap"));const sel=getSelection();sel.removeAllRanges();sel.addRange(r);$("copyCap").textContent="Selected, copy it"}setTimeout(()=>$("copyCap").textContent="Copy caption",1800)};
export function freshCard() { cardLinesTouched = false; return drawCard(); }
