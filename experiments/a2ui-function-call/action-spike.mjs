// Does an authored `action.functionCall` execute on PRESS, and what happens to
// its result? Drives the real GenericBinder — no React.
import { z } from 'zod';
import { Catalog, createFunctionImplementation } from '@a2ui/web_core/v0_9/catalog';
import { MessageProcessor } from '@a2ui/web_core/v0_9/processor';
import { ComponentContext, GenericBinder } from '@a2ui/web_core/v0_9/bindings';
import { CommonSchemas } from '@a2ui/web_core/v0_9/common-schemas';
const { Action: ActionSchema } = CommonSchemas;

const calls = [];
const api = { name: 'testDouble', returnType: 'number', schema: z.object({ value: z.number() }) };
const asyncApi = { ...api, name: 'testAsyncDouble' };
const catalog = new Catalog('spike', [{ name: 'Button', schema: z.object({ action: ActionSchema }) }], [
  createFunctionImplementation(api, ({ value }) => { calls.push(['sync', value]); return value * 2; }),
  createFunctionImplementation(asyncApi, async ({ value }) => { calls.push(['async', value]); return value * 2; }),
]);

const dispatched = [];
const processor = new MessageProcessor([catalog], (a) => { dispatched.push(a); });
processor.processMessages([
  { version: 'v0.9', createSurface: { surfaceId: 's', catalogId: 'spike', sendDataModel: true } },
  { version: 'v0.9', updateDataModel: { surfaceId: 's', path: '/working', value: { value: 21 } } },
  { version: 'v0.9', updateComponents: { surfaceId: 's', components: [
    { id: 'root', component: 'Button', action: { functionCall: { call: 'testDouble', args: { value: { path: '/working/value' } } } } },
  ] } },
]);

const surface = processor.model.getSurface('s');
const ctx = new ComponentContext(surface, 'root', '/');
const binder = new GenericBinder(ctx, z.object({ action: ActionSchema }));

console.log('calls BEFORE press :', JSON.stringify(calls), '  <-- must be empty (lazy)');
const action = binder.snapshot.action;
console.log('action prop type   :', typeof action);

const returned = action?.();
console.log('calls AFTER press  :', JSON.stringify(calls));
console.log('press returned     :', returned);
console.log('dispatched to host :', JSON.stringify(dispatched));
console.log('data model /working:', JSON.stringify(surface.dataModel.get('/working')), ' <-- result stored anywhere?');
