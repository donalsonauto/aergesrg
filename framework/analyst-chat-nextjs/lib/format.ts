// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
export const money=(n:number|null)=>n===null?"Insufficient data":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",notation:"compact",minimumFractionDigits:1,maximumFractionDigits:1}).format(n);
export const units=(n:number|null)=>n===null?"—":new Intl.NumberFormat("en-US",{maximumFractionDigits:1}).format(n);
export const percent=(n:number|null)=>n===null?"—":n.toFixed(1)+"%";
export const month=(p:string)=>new Date(p+"-01T12:00:00Z").toLocaleDateString("en-US",{month:"short",year:"2-digit",timeZone:"UTC"});
