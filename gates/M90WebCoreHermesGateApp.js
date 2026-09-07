import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { Catalog } from '@a2ui/web_core/v0_9/catalog';
import { DataContext } from '@a2ui/web_core/v0_9/data-context';
import { MessageProcessor } from '@a2ui/web_core/v0_9/processor';
import { TextApi } from '@a2ui/web_core/src/v0_9/basic_catalog/components/basic_components.js';

const MARKER = 'M90_WEB_CORE_HERMES_RESULT::';

export default function M90WebCoreHermesGateApp() {
  const started = useRef(false);
  const [result, setResult] = useState('Starting A2UI web_core Hermes probe...');

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      try {
      const catalog = new Catalog('https://gather.slu.edu/a2ui/probes/web-core-v0.9.json', [TextApi]);
      let actionName;
      const processor = new MessageProcessor([catalog], (action) => {
        actionName = action.name;
      });
      processor.processMessages([
        {
          version: 'v0.9',
          createSurface: {
            surfaceId: 'gather-web-core-probe',
            catalogId: catalog.id,
            sendDataModel: true,
          },
        },
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'gather-web-core-probe',
            components: [{ id: 'probe-text', component: 'Text', text: { path: '/status' } }],
          },
        },
        {
          version: 'v0.9',
          updateDataModel: {
            surfaceId: 'gather-web-core-probe',
            path: '/',
            value: { status: 'ready' },
          },
        },
      ]);
      const surface = processor.model.getSurface('gather-web-core-probe');
      const text = new DataContext(surface, '/').resolveDynamicValue(
        surface?.componentsModel.get('probe-text')?.properties.text
      );
      const dataModel = processor.getClientDataModel();
      await surface?.dispatchAction({ event: { name: 'gather.probe', context: {} } }, 'probe-text');
      const ok = text === 'ready'
        && dataModel?.surfaces['gather-web-core-probe']?.status === 'ready'
        && actionName === 'gather.probe';
      const value = { ok, engine: '@a2ui/web_core/v0_9', operations: ['catalog', 'processor', 'surface', 'data-model', 'binding', 'action'] };
      if (!ok) throw new Error('A2UI web_core v0.9 did not resolve a bound data-model value.');
      console.log(`${MARKER}${JSON.stringify(value)}`);
      setResult(JSON.stringify(value));
      } catch (error) {
        const value = { ok: false, message: error instanceof Error ? error.message : String(error) };
        console.log(`${MARKER}${JSON.stringify(value)}`);
        setResult(JSON.stringify(value));
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text>{result}</Text>
    </View>
  );
}
