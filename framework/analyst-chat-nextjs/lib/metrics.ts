// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
import type { Row } from "./data";
export function monthIndex(p:string){const [y,m]=p.split("-").map(Number);return y*12+m-1;}
export function monthName(n:number){return Math.floor(n/12)+"-"+String(n%12+1).padStart(2,"0");}
export function periodGrid(start:string,end:string){return Array.from({length:Math.max(0,monthIndex(end)-monthIndex(start)+1)},(_,i)=>monthName(monthIndex(start)+i));}
const sum=(a:number[])=>a.reduce((x,y)=>x+y,0);
const ratio=(a:number|null,b:number|null)=>a===null||b===null||b===0?null:a/b;
export function analyze(rows:Row[],periods:string[]) {
 return [...new Set(rows.map(r=>r.source))].map(source=>{
 const rs=rows.filter(r=>r.source===source);
 const total=(key:"leads"|"sales"|"gross"|"new_sales"|"used_sales"|"budget")=>rs.some(r=>r[key]===null)?null:sum(rs.map(r=>r[key] as number));
 const timeline=periods.map(period=>{
 const at=rs.filter(r=>r.period===period);
 const val=(key:"sales"|"leads")=>at.some(r=>r[key]===null)?null:sum(at.map(r=>r[key] as number));
 const sales=val("sales"),leads=val("leads");
 return {period,sales,leads,close:ratio(sales,leads)===null?null:ratio(sales,leads)!*100};
 });
 const totalSales=total("sales"),totalLeads=total("leads"),totalGross=total("gross");
 const closingRatio=ratio(totalSales,totalLeads),avgGrossPerSale=ratio(totalGross,totalSales);
 const active=timeline.filter(p=>p.sales!==null&&p.sales>0);
 const lastActiveMonth=active.at(-1)?.period??null;
 const monthsInactive=lastActiveMonth?monthIndex(periods.at(-1)!)-monthIndex(lastActiveMonth):periods.length;
 const valid=timeline.every(p=>p.sales!==null);
 const rolling=timeline.map((_,i)=>i<2?null:sum(timeline.slice(i-2,i+1).map(p=>p.sales??0))/3);
 const peakMonthlySales=valid?Math.max(0,...rolling.filter((x):x is number=>x!==null)):null;
 const peakIndex=rolling.indexOf(peakMonthlySales);
 const peakPeriod=peakIndex>=2?periods[peakIndex-2]+" – "+periods[peakIndex]:null;
 const recentMonthlySales=valid?sum(timeline.slice(-3).map(p=>p.sales??0))/Math.min(3,periods.length):null;
 const historicalMonthlySales=valid&&active.length?sum(active.map(p=>p.sales!))/active.length:null;
 const status=!valid?"unknown":monthsInactive>=3?"dormant":recentMonthlySales!<0.30*peakMonthlySales!?"declining":"steady";
 const estimatedMonthlySales=historicalMonthlySales===null||recentMonthlySales===null?null:Math.max(0,historicalMonthlySales-recentMonthlySales);
 const estimatedMonthlyRevenue=totalSales===null||totalSales<5||avgGrossPerSale===null||estimatedMonthlySales===null?null:estimatedMonthlySales*avgGrossPerSale;
 const budget=total("budget"),newSales=total("new_sales"),usedSales=total("used_sales");
 const confidence=Math.min(100,Math.max(0,40+30*Math.min(active.length/12,1)+20*Math.min((totalSales??0)/50,1)+10*(budget!==null?1:0)));
 return {source,leadTypes:[...new Set(rs.map(r=>r.lead_type))],totalSales,totalLeads,totalGross,closingRatio:closingRatio===null?null:closingRatio*100,avgGrossPerSale,newSales,usedSales,pctNew:newSales===null||usedSales===null?null:ratio(newSales,newSales+usedSales)!*100,activeMonths:active.length,totalMonths:periods.length,lastActiveMonth,monthsInactive,peakMonthlySales,peakPeriod,recentMonthlySales,historicalMonthlySales,status,estimatedMonthlySales,estimatedMonthlyRevenue,confidence,budget,cpl:ratio(budget,totalLeads),cps:ratio(budget,totalSales),netProfit:budget===null||totalGross===null?null:totalGross-budget,roi:budget===null||totalGross===null||budget===0?null:(totalGross-budget)/budget*100,timeline};
 }).sort((a,b)=>(b.estimatedMonthlyRevenue??-1)-(a.estimatedMonthlyRevenue??-1));
}
export type SourceMetric=ReturnType<typeof analyze>[number];
export function rollup(metrics:SourceMetric[]){
 const opportunities=metrics.filter(m=>m.status==="dormant"||m.status==="declining");
 return {revenue:sum(opportunities.map(m=>m.estimatedMonthlyRevenue??0)),sales:sum(opportunities.filter(m=>m.estimatedMonthlyRevenue!==null).map(m=>m.estimatedMonthlySales??0)),dormant:metrics.filter(m=>m.status==="dormant").length,declining:metrics.filter(m=>m.status==="declining").length};
}
export function filterData(rows:Row[],store="All",years=3,type="All"){
 const end=rows.map(r=>r.period).sort().at(-1)!;
 const start=monthName(Math.max(monthIndex(rows.map(r=>r.period).sort()[0]),monthIndex(end)-years*12+1));
 const filtered=rows.filter(r=>r.period>=start&&r.period<=end&&(store==="All"||r.store===store)&&(type==="All"||r.lead_type===type));
 return {rows:filtered,periods:periodGrid(start,end)};
}
export function monthlyChanges(current:Record<string,number|null>,previous:Record<string,number|null>){
 return Object.entries(current).flatMap(([metric,value])=>{const prior=previous[metric];if(value===null||prior==null||prior===0)return [];const change=(value-prior)/Math.abs(prior)*100;return Math.abs(change)<20?[]:[{metric,value,change,question:metric+" "+(change<0?"dropped":"grew")+" by "+Math.abs(change).toFixed(1)+"% — what's driving this?"}];}).sort((a,b)=>Math.abs(b.change)-Math.abs(a.change)).slice(0,5);
}
