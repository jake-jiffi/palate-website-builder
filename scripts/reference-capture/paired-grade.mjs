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
 * Run 2026-08-06, 8 Palate demos vs 11 reachable ordinary small-business sites (plumbers,
 * dentists, trades directories, a bakery: the population the grader actually receives):
 *   PALATE    n=8   median 0.93   0.3 failing checks per site   6 of 8 with none
 *   ordinary  n=11  median 0.68   1.6 failing checks per site   1 of 11 with none
 *
 * The ordinary set is NOT uniformly bad, which is what makes the comparison worth anything:
 * smilegeneration.com scores 0.92 with no failing check. A gate that failed every site outside
 * our own would be measuring nothing.
 *
 * THE COMPARISON IS PARTLY CONFOUNDED, AND THIS WAS MEASURED RATHER THAN CONCEDED. The two
 * populations are not the same size of thing. Medians:
 *
 *              DOM nodes  controls  media  internal routes  page height
 *   PALATE           234        29      1               10       5375px
 *   ordinary        1508       174     44               59       5637px
 *
 * Six times the nodes, six times the controls, forty-four times the media. Only scroll height
 * is comparable. So the headline gap is NOT clean evidence that Palate builds are better: some
 * of it is that they are smaller, and a page with one image will beat a page with forty-four
 * on LCP whoever built it.
 *
 * The split that survives the confound:
 *   MOSTLY FAIR    colour_accent_discipline and type_system_discipline - a framework-default
 *                  accent is a framework default at any page size, and so is a default-only
 *                  type stack. responsive_integrity too, since it scores the SHARE of controls
 *                  under 24px rather than the count, which is why it was normalised.
 *   CONFOUNDED     lcp, cls, responsiveness, js_execution_and_payload. These scale with how
 *                  much a page carries, and the ordinary set carries far more.
 *
 * THE SURVIVING HALF IS NOW MEASURED, NOT ARGUED. Splitting the checks by whether they should
 * be complexity-independent was reasoning; testing it was one more run. Pearson r between DOM
 * node count and each design check, across the ordinary population spanning 5 to 15,510 nodes:
 *
 *   colour_accent_discipline   r = +0.18
 *   type_system_discipline     r = -0.01
 *   responsive_integrity       r = +0.19
 *
 * All near zero, and if anything faintly POSITIVE, so bigger pages do not score worse on these.
 * The three checks measure craft rather than size, which is what the split claimed and had not
 * shown.
 *
 * THE VITALS CONFOUND IS REAL BUT MODERATE, and "no correlation test rescues them" was lazier
 * than measuring it. Pearson r between media-element count and each vitals check across the
 * ordinary population, spanning 0 to 146 media elements:
 *
 *   lcp             r = -0.33   (r-squared 0.11)
 *   cls             r = -0.27   (0.07)
 *   responsiveness  r = -0.56   (0.31)
 *   js payload      r = -0.35   (0.12)
 *
 * All negative, so carrying more genuinely costs a page and the confound is confirmed. But it
 * explains 7 to 31 percent of the variance, leaving 69 to 93 percent attributable to how the
 * site was BUILT rather than how much it carries. Responsiveness is the most size-driven of the
 * four and should be read most cautiously across populations of different weight; CLS is nearly
 * independent of it. So the vitals half of this result is weakened by the confound, not voided.
 *
 * So the defensible claim is narrower than the number looks: on the complexity-independent
 * design checks a Palate build clears the bar and most ordinary sites do not. Whether it would
 * still clear it at 1,500 nodes and 44 images is untested, and the only test that settles it is
 * a real rebuild of a real trading business re-graded against its own baseline.
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
const ORDINARY=['https://shortysplumbingllc.com','https://neptuneplumbing.net','https://localplumbercolumbus.com',
  'https://www.mrrooter.com','https://www.rotorooter.com','https://www.aptdental.com',
  'https://www.gentledental.com','https://www.smilegeneration.com','https://www.jimsmowing.com.au',
  'https://www.hipages.com.au','https://www.bakerdays.com'];
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
