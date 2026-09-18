// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
export type Row = { period:string; store:string; source:string; lead_type:string; leads:number|null; sales:number|null; gross:number|null; new_sales:number|null; used_sales:number|null; budget:number|null };
export const COLUMN_MAP = {period:"period",store:"store",source:"source",lead_type:"lead_type",leads:"leads",sales:"sales",gross:"gross",new_sales:"new_sales",used_sales:"used_sales",budget:"budget"} as const;
export function normalizePeriod(input:string) {
 const s=input.trim();
 if (/^\d{4}-\d{2}(?:-\d{2})?$/.test(s)) return s.slice(0,7);
 const us=s.match(/^(\d{1,2})\/\d{1,2}\/(\d{4})$/);
 if(us) return us[2]+"-"+us[1].padStart(2,"0");
 const named=s.match(/^([A-Za-z]{3})\s+(\d{4})$/);
 if(named) { const i=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(named[1].toLowerCase()); if(i>=0)return named[2]+"-"+String(i+1).padStart(2,"0"); }
 throw new Error("Unrecognized period format");
}
export function loadData():Row[] {
 const records=parse(fs.readFileSync(path.join(process.cwd(),"sample-data/leads_monthly.csv"),"utf8"),{columns:true,skip_empty_lines:true,trim:true}) as Record<string,string>[];
 return records.map(r=>{
 const result:Record<string,string|number|null>={};
 for(const [from,to] of Object.entries(COLUMN_MAP)) {
 const raw=r[from]?.trim() ?? "";
 if(["period","store","source","lead_type"].includes(to))result[to]=to==="period"?normalizePeriod(raw):raw;
 else { const n=raw===""?null:Number(raw.replace(/[$,()]/g,""))*(raw.startsWith("(")?-1:1); if(n!==null&&!Number.isFinite(n))throw new Error("Invalid numeric column: "+from);result[to]=n; }
 }
 return result as Row;
 });
}
