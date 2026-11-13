const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),ts=require(path.join(root,'node_modules/typescript'));
function extract(file,name){const source=fs.readFileSync(path.join(root,file),'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let found;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)found=n.initializer.getText(ast);if(ts.isFunctionDeclaration(n)&&n.name?.text===name)found=n.getText(ast).replace('export ','');ts.forEachChild(n,visit);}visit(ast);return found;}
test('Store origin preserves fulfillment choice and supports delivery/pickup inventory routing',()=>{
 const state={type:"delivery",fee:3};const ctx={setSelectedChannel:v=>state.source=v,setOrderType:v=>state.type=v,setDiscountType:v=>state.discount=v,setDeliveryFee:v=>state.fee=v};
 vm.runInNewContext('('+extract('src/screens/PosTerminalScreen.tsx','handleSelectChannelSource')+')("Store")',ctx);
 assert.deepEqual(state,{source:'POS',type:'delivery',discount:'none',fee:3});
 const fn=extract('src/pos/services/posOrderService.ts','resolveCanonicalSalesChannel');const code=ts.transpileModule(fn+'; result=[resolveCanonicalSalesChannel("delivery","Phone"),resolveCanonicalSalesChannel("pickup","Phone")]',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;const out={};vm.runInNewContext(code,out);assert.deepEqual(Array.from(out.result),['DELIVERY','TAKEAWAY']);
});
