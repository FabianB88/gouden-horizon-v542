import {AREAS,AREA_BY_ID,WORLD} from './data.js?v=12';
export const SAFE_HUBS=['canal','highway','forest','skybridge'];
export const SERVICE_INFO={
 smith:{name:'Mara · Focusmaker',title:'Focusmaker',slots:['weapon','relic','gloves'],text:'Precisie of elementkracht? Kies een focus die bij je spreuken past.',file:'smith'},
 outfitter:{name:'Jules · Veldhandel',title:'Veldhandel',slots:['suit','boots','belt'],text:'Snel bewegen helpt. Bescherming geeft je tijd om een fout te herstellen.',file:'outfitter'},
 workshop:{name:'Inez · Werkplaats',title:'Werkplaats',slots:[],text:'Ik versterk wat je al draagt. Een vertrouwde vondst hoeft niet meteen vervangen te worden.',file:'workshop'}
};
const routeCache=new Map();
function inside(x,y,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function valid(point,id){return [[0,0],[22,0],[-22,0],[0,22],[0,-22]].every(([dx,dy])=>AREA_BY_ID[id].nav.some(poly=>inside((point.x+dx)/WORLD.width,(point.y+dy)/WORLD.height,poly)));}
// Placement stays on traced floors; integration QA walks every service and gate.
export function hubPoint(id,t){
 const key=id+':'+t;if(routeCache.has(key))return {...routeCache.get(key)};
 const a=AREA_BY_ID[id],start={x:a.spawn[0]*WORLD.width,y:a.spawn[1]*WORLD.height},wanted={x:(a.spawn[0]+(a.exit[0]-a.spawn[0])*t)*WORLD.width,y:(a.spawn[1]+(a.exit[1]-a.spawn[1])*t)*WORLD.height};
 const candidates=[];for(let dy=-144;dy<=144;dy+=24)for(let dx=-144;dx<=144;dx+=24){const p={x:wanted.x+dx,y:wanted.y+dy};if(valid(p,id))candidates.push(p);}
 candidates.sort((a,b)=>Math.hypot(a.x-wanted.x,a.y-wanted.y)-Math.hypot(b.x-wanted.x,b.y-wanted.y));
 const p=candidates[0]||start;routeCache.set(key,p);return {...p};
}
const quayPositions={smith:[.142,.728],outfitter:[.638,.562],workshop:[.838,.400]};
export const QUAY_SUPPLY=[.898,.427];
export function hubMerchants(id){return ['smith','outfitter','workshop'].map((service,i)=>({id:service,service,...(id==='canal'?{x:quayPositions[service][0]*WORLD.width,y:quayPositions[service][1]*WORLD.height}:hubPoint(id,[.08,.29,.46][i])),...SERVICE_INFO[service]}));}
export function fixedHubPortals(g,id){
 const routes={canal:['delta','ring','rooftops'],highway:['mirrors','brine','kilometer','forest'],forest:['glass','saltwood','vault'],skybridge:['harbor','clouds','aurelia']},targets=routes[id];if(!targets)return null;
 return targets.map((to,i)=>{const a=AREA_BY_ID[to],category=a.side?'arena':a.kind==='hub'?'generator':'route';return {id:'gate-'+to,to,...hubPoint(id,targets.length===4?[.60,.74,.87,1][i]:[.64,.82,1][i]),category,story:true,locked:!g.canSelectDestination(to),reason:'Voltooi eerst '+AREA_BY_ID[g.recommendedArea()].name};});
}
export const hubPortals=fixedHubPortals;
export const HubRules={
 prepareHub(w,area){
  if(!SAFE_HUBS.includes(area.id))return;
  w.safeHub=true;w.enemies=w.enemies.filter(e=>e.dead);w.hazards=[];w.threats=[];w.camp.services=hubMerchants(area.id);
  if(!w.hubVersion){w.hubVersion=1;const point=area.id==='canal'?{x:QUAY_SUPPLY[0]*WORLD.width,y:QUAY_SUPPLY[1]*WORLD.height}:hubPoint(area.id,.38);w.loot.push({id:++this.idCounter,...point,type:'loot',hiddenSupply:true,profile:'expedition'});}
  if(area.id==='canal'){
   const oldLayout=w.quayLayoutVersion!==2;
   for(const loot of w.loot.filter(i=>!i.item)){const point=loot.hiddenSupply?QUAY_SUPPLY:[.707,.590];loot.x=point[0]*WORLD.width;loot.y=point[1]*WORLD.height;}
   // A save in the former stair corridor must never resume outside the new floor.
   if(oldLayout&&this.state.area==='canal'&&this.state.world===w&&!valid(this.state.player,'canal')){
    const p=this.state.player,candidates=[];
    for(let dy=-240;dy<=240;dy+=12)for(let dx=-240;dx<=240;dx+=12){const point={x:p.x+dx,y:p.y+dy};if(valid(point,'canal'))candidates.push(point);}
    candidates.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
    const point=candidates[0]||{x:area.spawn[0]*WORLD.width,y:area.spawn[1]*WORLD.height};Object.assign(p,point,{velocity:{x:0,y:0},moving:false,walkBlend:0});
   }
   w.quayLayoutVersion=2;
  }
 },
 inCamp(point=this.state.player){if(SAFE_HUBS.includes(this.state.area))return true;const camp=this.state.world?.camp;return Boolean(camp&&Math.hypot(camp.x-point.x,(camp.y-point.y)*1.15)<camp.radius);},
 hubMerchants(id=this.state.area){return SAFE_HUBS.includes(id)?hubMerchants(id):this.state.world?.camp?[{id:'smith',service:'smith',...this.state.world.camp.merchant,...SERVICE_INFO.smith}]:[];},
 nearbyMerchant(){return this.hubMerchants().filter(m=>Math.hypot(m.x-this.state.player.x,(m.y-this.state.player.y)*1.15)<115).sort((a,b)=>Math.hypot(a.x-this.state.player.x,a.y-this.state.player.y)-Math.hypot(b.x-this.state.player.x,b.y-this.state.player.y))[0]||null;},
 service(){return this.state.pending?.service||this.nearbyMerchant()?.service||'smith';},
 shopItems(service=this.service()){const slots=SERVICE_INFO[service].slots;return this.state.world.shop.stock.filter(i=>slots.includes(i.slot));},
 nearbyService(){return this.nearbyMerchant();},
 currentService(){return this.state.world.camp?.services?.find(m=>m.id===this.state.pending?.service)||this.nearbyService()||null;},
 serviceStock(){const service=this.currentService();return service?this.shopItems(service.id):this.state.world.shop.stock;},
 migrateHubs(){
  const s=this.state;for(const worlds of [s.areas,s.checkpoint?.areas])for(const [id,w]of Object.entries(worlds||{})){if(!SAFE_HUBS.includes(id))continue;w.safeHub=true;w.enemies=w.enemies.filter(e=>e.dead);w.hazards=[];w.threats=[];w.merchants=hubMerchants(id);}
 }
};
