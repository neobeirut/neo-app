const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=process.env.FLOW_POS_ROOT||path.resolve(__dirname,'..'),ts=require('typescript');
test('Close Shift includes current branch sales and excludes other days, branches and drawers',async()=>{
 const source=fs.readFileSync(path.join(root,'src/pos/components/CloseShiftModal.tsx'),'utf8');
 const ast=ts.createSourceFile('modal.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let fn;
 function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='checkOpenEntitiesAndSales')fn=n.initializer;ts.forEachChild(n,visit);}visit(ast);assert(fn);
 const base={id:386,status:'completed',restaurant_id:'r',branch_id:'uuid',terminal_id:'term',created_at:'2026-09-28T06:00:00Z',total_amount:5,exchange_rate:89500,payment_method:'Cash USD'};
 const rows=[base,{...base,id:1,branch_id:'2',total_amount:3},{...base,id:2,branch_id:'other'},{...base,id:3,terminal_id:'other'},{...base,id:4,restaurant_id:'other'},{...base,id:5,created_at:'2026-09-27T06:00:00Z'},{...base,id:6,created_at:'2026-09-28T12:00:00Z'}];
 function from(table){let data=table==='pos_orders'?[...rows]:[];const q={select:()=>q,not:()=>q,order:()=>q,range:(a,b)=>{data=data.slice(a,b+1);return q;},eq:(k,v)=>{data=data.filter(r=>r[k]===v);return q;},in:(k,v)=>{data=data.filter(r=>v.includes(r[k]));return q;},gte:(k,v)=>{data=data.filter(r=>r[k]>=v);return q;},lt:(k,v)=>{data=data.filter(r=>r[k]<v);return q;},then:resolve=>resolve({data,error:null})};return q;}
 const paymentExports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'src/pos/services/shiftPaymentOrders.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:paymentExports,require:()=>({supabase:{from}}),Date});
 let sales;const errors=[];const noop=()=>{};
 const ctx={result:null,loadShiftPaymentOrders:paymentExports.loadShiftPaymentOrders,isScheduledCarryover:()=>false,shift:{branch_id:'uuid',restaurant_id:'r',terminal_id:'drawer'},branchId:'uuid',externalBranchId:'2',terminalId:'term',supabase:{from},getDrawerTerminalAliases:async()=>['drawer','term'],loadShiftReportingPeriod:async()=>({startTime:'2026-09-28T05:00:00Z',endTime:'2026-09-28T12:00:00Z'}),setCheckingEntities:noop,setOpenTables:noop,setOpenOrders:noop,setSalesLbp:v=>sales=v,setOnCreditLbp:noop,setErrorMessage:e=>errors.push(e),reconData:null,console};
 vm.runInNewContext(ts.transpileModule('result='+fn.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
 await ctx.result(89500);assert.deepEqual(errors,[]);assert.equal(Number(sales),8*89500);
});
