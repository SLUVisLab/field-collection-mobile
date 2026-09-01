import { Fragment, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ComponentContext, GenericBinder } from '@a2ui/web_core/v0_9/bindings';
import { ButtonApi, ColumnApi, TextApi } from '@a2ui/web_core/v0_9/basic_catalog';

import { useTheme } from '../../theme/useTheme.js';
import { Button as SharedButton, tokens } from 'gather-components';

const useBoundProps = (context, schema) => {
  const binderRef = useRef(null);
  if (!binderRef.current || binderRef.current.context !== context) {
    binderRef.current?.dispose();
    binderRef.current = new GenericBinder(context, schema);
  }
  const binder = binderRef.current;
  const subscribe = useCallback((notify) => {
    const subscription = binder.subscribe(notify);
    return () => subscription.unsubscribe();
  }, [binder]);
  const getSnapshot = useCallback(() => binder.snapshot, [binder]);
  useEffect(() => () => binder.dispose(), [binder]);
  return useSyncExternalStore(subscribe, getSnapshot);
};

function InstrumentNode({ surface, componentId, implementations, basePath = '/' }) {
  const store = useMemo(() => {
    let version = 0;
    return {
      subscribe(notify) {
        const created = surface.componentsModel.onCreated.subscribe(() => { version += 1; notify(); });
        const deleted = surface.componentsModel.onDeleted.subscribe(() => { version += 1; notify(); });
        return () => { created.unsubscribe(); deleted.unsubscribe(); };
      },
      getSnapshot() {
        const model = surface.componentsModel.get(componentId);
        return model ? `${model.type}-${version}` : `missing-${version}`;
      },
    };
  }, [surface, componentId]);
  useSyncExternalStore(store.subscribe, store.getSnapshot);
  const model = surface.componentsModel.get(componentId);
  const implementation = model ? implementations[model.type] : null;
  const context = useMemo(
    () => model && implementation ? new ComponentContext(surface, componentId, basePath) : null,
    [surface, componentId, basePath, model, implementation]
  );
  if (!model || !implementation || !context) return null;
  return <implementation.component context={context} buildChild={(id, path) => <InstrumentNode surface={surface} componentId={id} implementations={implementations} basePath={path ?? basePath} />} />;
}

export function bindInstrumentComponent(schema, Component) {
  return function BoundInstrumentComponent({ context, buildChild }) {
    const props = useBoundProps(context, schema);
    return <Component {...props} context={context} buildChild={buildChild} />;
  };
}

export function A2uiInstrumentSurface({ surface, implementations }) {
  return <InstrumentNode surface={surface} componentId="root" implementations={implementations} />;
}

export const mobileBasicImplementations = {
  Column: {
    component: bindInstrumentComponent(ColumnApi.schema,
      ({ children, buildChild }) => (
        <View style={styles.column}>
          {(children ?? []).map((child) => <Fragment key={child}>{buildChild(child)}</Fragment>)}
        </View>
      )
    ),
  },
  Text: {
    component: bindInstrumentComponent(TextApi.schema, ({ text, variant = 'body' }) => {
      const theme = useTheme();
      const variantStyle =
        variant === 'h1'
          ? styles.h1
          : variant === 'h2'
            ? styles.h2
            : variant === 'h3'
              ? styles.h3
              : variant === 'h4' || variant === 'h5'
                ? styles.h4
                : variant === 'caption'
                  ? styles.caption
                  : styles.body;
      return <Text style={[variantStyle, { color: theme.colors.text }]}>{text}</Text>;
    }),
  },
  Button: {
    component: bindInstrumentComponent(ButtonApi.schema, ({ action, child, variant, isValid, context, buildChild }) => {
      const mappedVariant = variant === 'primary' ? 'primary' : variant === 'borderless' ? 'borderless' : 'secondary';
      const childModel = child ? context?.surface?.componentsModel?.get(child) : null;
      const label = typeof childModel?.properties?.text === 'string' ? childModel.properties.text : undefined;
      return (
        <SharedButton
          onPress={action}
          label={label}
          variant={mappedVariant}
          disabled={isValid === false}
          style={styles.button}
        >
          {label ? null : <View style={styles.buttonLabel}>{child ? buildChild(child) : null}</View>}
        </SharedButton>
      );
    }),
  },
};

const styles = StyleSheet.create({
  column: { gap: 12 },
  h1: { fontSize: tokens.typography.title, fontWeight: '700', lineHeight: tokens.typography.title * 1.2 },
  h2: { fontSize: tokens.typography.heading, fontWeight: '700', lineHeight: tokens.typography.heading * 1.2 },
  h3: { fontSize: tokens.typography.body, fontWeight: '700', lineHeight: tokens.typography.bodyLineHeight },
  h4: { fontSize: tokens.typography.body, fontWeight: '600', lineHeight: tokens.typography.bodyLineHeight },
  body: { fontSize: tokens.typography.body, fontWeight: '400', lineHeight: tokens.typography.bodyLineHeight },
  caption: { fontSize: tokens.typography.helper, fontWeight: '400', lineHeight: tokens.typography.helperLineHeight },
  button: { alignSelf: 'stretch' },
  buttonLabel: { alignItems: 'center' },
});
