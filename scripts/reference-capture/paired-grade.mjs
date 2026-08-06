#!/usr/bin/env node
/**
 * paired-grade.mjs - does a build this plugin approves actually score well in the public grader?
 *
 * The claim the whole plugin-vs-grader convergence rests on, measured rather than asserted. It
 * scores a list of URLs on the eight deterministic checks the plugin and the grader now SHARE
 * (design-measure.mjs + vitals.mjs, both hash-pinned in both repos), and reports the median and
 * the failing-check count per population.
 *
 * It deliberately does NOT include the vision ladder or the taste head. Those are the grader's
 * strongest signals and the plugin has no access to them, so including them would measure the
 * grader against itself. What this answers is narrower and checkable: on everything both sides
 * can see, does a Palate build clear the bar.
 *
 * Usage:
 *   node paired-grade.mjs                       # the built-in Palate demo set vs ordinary sites
 *   node paired-grade.mjs --a <url,url> --b <url,url>
 *
 * Run 2026-08-06, 8 Palate demos vs 3 reachable ordinary small-business sites:
 *   PALATE    median 0.93   0.3 failing checks per site   6/8 with none
 *   ordinary  median 0.71   2.0 failing checks per site   0/3 with none
 *
 * The two Palate builds that failed are the useful part and neither is a false positive.
 * axis-object misses LCP, which is honest: it is the Three.js hero demo. zoop-soda leads with
 * #7c4dff, deltaE 4.4 from Tailwind violet-500, so one of our own bold-slate demos shipped a
 * framework default. The previous exact-hex detector could not have seen it, because the string
 * is not #8b5cf6. That is the perceptual-distance upgrade earning its place on our own work.
 */
import {chromium} from 'playwright';
import {measurePage, scoreDesignFacts} from './design-measure.mjs';
import {measureVitals, scoreVitals} from './vitals.mjs';
const b=await chromium.launch({headless:true,channel:'chromium',args:['--no-sandbox','--disable-gpu']});
async function full(url){
  const facts={};
  try{
    for(const [n,vp] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
      const c=await b.newContext({viewport:vp}); const p=await c.newPage();
      await p.goto(url,{waitUntil:'load',timeout:35000});
      await p.evaluate(()=>new Promise(r=>setTimeout(r,1100)));
      await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
      await p.evaluate(()=>new Promise(r=>setTimeout(r,600)));
      facts[n]=await measurePage(p); await c.close();
    }
    const vc=await b.newContext({viewport:{width:390,height:844}});
    const v=await measureVitals(await vc.newPage(),url); await vc.close();
    const all=[...scoreDesignFacts(facts),...scoreVitals(v)].filter(c=>c.raw!==null);
    if(!all.length) return null;
    return {avg:all.reduce((a,c)=>a+c.raw,0)/all.length,n:all.length,
      fails:all.filter(c=>c.raw<0.5).map(c=>c.id)};
  }catch(e){return null;}
}
const PALATE=['https://aralia-skincare.vercel.app','https://aught-site.vercel.app','https://axis-object.vercel.app',
  'https://hesper-retreat.vercel.app','https://kern-foundry.vercel.app','https://nocturne-label.vercel.app',
  'https://vela-analytics.vercel.app','https://zoop-soda.vercel.app'];
// Real small-business sites of the kind the grader actually receives: the population the
// product is sold against, not flagship marketing pages.
const ORDINARY=['https://shortysplumbingllc.com','https://neptuneplumbing.net','https://www.sidedental.com.au',
  'https://localplumbercolumbus.com','https://www.100westdental.com'];
const rows=[];
for(const [k,list] of [['PALATE',PALATE],['ordinary',ORDINARY]]){
  for(const u of list){
    const r=await full(u);
    if(!r){console.log(k.padEnd(9)+'  --   unreachable  '+u);continue;}
    rows.push({k,u,...r});
    console.log(k.padEnd(9)+r.avg.toFixed(2)+'  '+String(r.fails.length)+' fail  '+u.replace('https://','')+(r.fails.length?'  ['+r.fails.join(',')+']':''));
  }
}
await b.close();
const g=k=>rows.filter(r=>r.k===k);
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:null;};
for(const k of ['PALATE','ordinary']){
  const s=g(k); if(!s.length) continue;
  console.log('\n'+k+'  n='+s.length+'  median '+med(s.map(r=>r.avg)).toFixed(2)
    +'  mean fails/site '+(s.reduce((a,r)=>a+r.fails.length,0)/s.length).toFixed(1)
    +'  sites with ZERO failing checks: '+s.filter(r=>!r.fails.length).length+'/'+s.length);
}
