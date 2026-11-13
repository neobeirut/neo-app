const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=process.env.FLOW_POS_ROOT||path.resolve(__dirname,'..'),ts=require(path.join(root,'node_modules/typescript'));
function load(file,imports){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,{exports,require:n=>imports[n]||{},Date,Intl,console});return exports;}
test('closed AM lookup is limited to today, restaurant, branch and drawer',async()=>{
 const calls=[];function from(table){const chain=new Proxy({}, {get:(_,key)=>key==='then'?resolve=>resolve({data:table==='shift_cash'?[{id:'closed',actual_usd:0,actual_lbp:0}]:[],error:null}):(...args)=>{calls.push([table,key,...args]);return chain;}});return chain;}
 const service=load('src/pos/services/shiftCashBridge.ts',{'../../api/supabase':{supabase:{from}},'./preparingOrders':{businessDay:()=> '2026-09-28'}});
 const branch='9c214659-9cc7-4f33-b115-cbbb8a823a94';const result=await service.getClosedAmShift(branch,'drawer','tenant');assert.equal(result.id,'closed');
 for(const [key,value] of [['date','2026-09-28'],['shift','AM'],['status','closed'],['restaurant_id','tenant'],['branch_id',branch]])assert(calls.some(c=>c[0]==='shift_cash'&&c[1]==='eq'&&c[2]===key&&c[3]===value));
 assert(calls.some(c=>c[0]==='shift_cash'&&c[1]==='in'&&c[2]==='terminal_id'&&c[3].includes('drawer')));
});
test('closed AM is disabled and selects PM even with a zero closing balance',()=>{
 const effects=[],updates=[],nodes=[];let index=0;
 const react={createElement:(type,props,...children)=>{const node={type,props:props||{},children};nodes.push(node);return node;},useState:initial=>{const i=index++;return [initial,v=>updates.push([i,v])];},useEffect:fn=>effects.push(fn)};
 const {OpenShiftModal}=load('src/pos/components/OpenShiftModal.tsx',{react});
 OpenShiftModal({isOpen:true,branchName:'Branch',cashierName:'Cashier',amShiftClosed:true,amClosingUsd:0,amClosingLbp:0,onClose(){},onConfirm(){}});
 effects.forEach(fn=>fn());assert(updates.some(([i,v])=>i===0&&v==='PM'));
 const am=nodes.find(n=>n.type==='button'&&n.children.includes('✓ AM Shift Closed'));assert(am);assert.equal(am.props.disabled,true);
});
test('AM stays available when today has no closed AM shift',()=>{
 const nodes=[];const react={createElement:(type,props,...children)=>{const node={type,props:props||{},children};nodes.push(node);return node;},useState:v=>[v,()=>{}],useEffect:()=>{}};
 const {OpenShiftModal}=load('src/pos/components/OpenShiftModal.tsx',{react});OpenShiftModal({isOpen:true,amShiftClosed:false,onClose(){},onConfirm(){}});
 assert.equal(nodes.find(n=>n.type==='button'&&n.children.includes('☀️ AM Shift (Morning)')).props.disabled,false);
});
