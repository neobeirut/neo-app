const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),{test}=require('node:test');const root=process.env.FLOW_POS_ROOT||path.resolve(__dirname,'..'),ts=require('typescript');
function load(file,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>imports[n]||{},Date,Intl,console});return exports;}
const days=load('src/pos/services/preparingOrders.ts');const {shiftReportingPeriod:period,dayStart}=load('src/pos/services/shiftReportingPeriod.ts',{'./preparingOrders':days});
const now=new Date('2026-09-28T08:00:00Z'),shift={id:'s',date:'2026-09-27',created_at:'2026-09-27T06:00:00Z'};
test('overdue shift stays open across midnight until a successor opens',()=>{const r=period(shift,now);assert.equal(r.startTime,new Date(shift.created_at).toISOString());assert.equal(r.endTime,now.toISOString());});
test('earlier closure or next shift caps the selected shift',()=>{assert.equal(period({...shift,closed_at:'2026-09-27T11:00:00Z'},now).endTime,'2026-09-27T11:00:00.000Z');assert.equal(period(shift,now,'2026-09-27T12:00:00Z').endTime,'2026-09-27T12:00:00.000Z');});
test('current-day shift reports only through now',()=>{assert.equal(period({date:'2026-09-28',created_at:'2026-09-28T06:00:00Z'},now).endTime,now.toISOString());});
test('backdated shift uses its business date rather than creation today',()=>{const r=period({...shift,created_at:now.toISOString()},now);assert.equal(r.startTime,'2026-09-26T21:00:00.000Z');assert.equal(r.day,'2026-09-27');});
test('day boundaries stay correct through Beirut DST changes',()=>{for(const date of ['2026-03-29','2026-10-25']){const start=dayStart(date);assert.equal(days.businessDay(new Date(start)),date);assert(days.businessDay(new Date(start-1))<date);}});
test('invalid business dates are rejected',()=>assert.throws(()=>dayStart('2026-02-30')));
test('reconciliation sends exclusive period end and both branch identifiers to the database',async()=>{const calls=[];function query(table){const chain=new Proxy({}, {get:(_,key)=>key==='then'?resolve=>resolve({data:table==='commerce_branch_links'?[{external_branch_id:'2'}]:[],error:null}):(...args)=>{calls.push([table,key,...args]);return chain;}});return chain;}const mod=load('src/pos/services/shiftReconciliationService.ts',{'../../api/supabase':{supabase:{from:query},getGlobalRestaurantId:()=> 'r'},'./shiftPaymentOrders':{loadShiftPaymentOrders:async p=>{calls.push(['payments',p]);return []}}});const window=period(shift,now);const result=await mod.calculateShiftReconciliation({locationKey:'branch',branchId:'uuid',externalBranchId:'2',restaurantId:'r',startTime:window.startTime,endTime:window.endTime,endExclusive:true,openingUsd:0,openingLbp:0});assert.equal(result.success,true);const p=calls.find(c=>c[0]==='payments')[1];assert.equal(p.endTime,window.endTime);assert.equal(p.endExclusive,true);assert.deepEqual(Array.from(p.branchIds),['uuid','2']);});


test('held night shift stops at next morning opening, even when closed later',()=>{
 const night={id:'night',date:'2026-09-27',status:'on_hold',created_at:'2026-09-27T15:00:00Z'};
 const next='2026-09-28T05:00:00Z';
 assert.equal(period(night,now,next).endTime,'2026-09-28T05:00:00.000Z');
 assert.equal(period({...night,status:'closed',closed_at:'2026-09-28T07:00:00Z'},now,next).endTime,'2026-09-28T05:00:00.000Z');
});
test('successor lookup crosses midnight and stays in the restaurant, branch and drawer',async()=>{
 const calls=[];const chain=new Proxy({}, {get:(_,key)=>key==='then'?resolve=>resolve({data:[{created_at:'2026-09-28T05:00:00Z'}],error:null}):(...args)=>{calls.push([key,...args]);return chain;}});
 const mod=load('src/pos/services/shiftReportingPeriod.ts',{'./preparingOrders':days,'../../api/supabase':{supabase:{from:()=>chain}}});
 const result=await mod.loadShiftReportingPeriod({id:'night',date:'2026-09-27',created_at:'2026-09-27T15:00:00Z',restaurant_id:'r',branch_id:'b',terminal_id:'drawer'},['drawer','terminal']);
 assert.equal(result.endTime,'2026-09-28T05:00:00.000Z');
 assert(calls.some(c=>c[0]==='eq'&&c[1]==='restaurant_id'&&c[2]==='r'));
 assert(calls.some(c=>c[0]==='eq'&&c[1]==='branch_id'&&c[2]==='b'));
 assert(calls.some(c=>c[0]==='in'&&c[1]==='terminal_id'&&c[2].includes('drawer')));
 assert(!calls.some(c=>c[0]==='lt'&&c[2]==='2026-09-27T21:00:00.000Z'));
});
