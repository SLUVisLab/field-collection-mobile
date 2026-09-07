// Spike A/B: does v0.9.1 already execute a registered renderer function?
import { z } from 'zod';
// The schema-free entry points our runtime uses (see patches/).
import { Catalog, createFunctionImplementation } from '@a2ui/web_core/v0_9/catalog';

const doubleApi = {
  name: 'testDouble',
  returnType: 'number',
  schema: z.object({ value: z.number() }),
};
const asyncApi = { ...doubleApi, name: 'testAsyncDouble' };

const catalog = new Catalog(
  'spike',
  [],
  [
    createFunctionImplementation(doubleApi, ({ value }) => value * 2),
    createFunctionImplementation(asyncApi, async ({ value }) => value * 2),
  ]
);

console.log('registered:', [...catalog.functions.keys()]);

// sync
console.log('sync  testDouble(21) =', catalog.invoker('testDouble', { value: 21 }, {}, undefined));

// async
const p = catalog.invoker('testAsyncDouble', { value: 21 }, {}, undefined);
console.log('async returns a Promise?', p instanceof Promise);
console.log('async awaited        =', await p);

// unknown function must fail loudly
try { catalog.invoker('nope', {}, {}, undefined); console.log('unknown: NO THROW ❌'); }
catch (e) { console.log('unknown throws:', e.constructor.name, '|', e.message); }

// invalid args must fail loudly
try { catalog.invoker('testDouble', { value: 'twenty-one' }, {}, undefined); console.log('bad args: NO THROW ❌'); }
catch (e) { console.log('bad args throws:', e.constructor.name, '|', String(e.message).slice(0, 60)); }

// arg coercion / stripping
console.log('extra args stripped  =', catalog.invoker('testDouble', { value: 5, junk: 'x' }, {}, undefined));
