import { Fragment, useCallback, useState } from 'react';
import { Image as RNImage, StyleSheet, Text as RNText, View } from 'react-native';
import { ButtonApi, ColumnApi, ImageApi, TextApi } from '@a2ui/web_core/v0_9/basic_catalog';

import { useTheme } from '../../theme/useTheme.js';
import { Button as SharedButton, tokens } from 'gather-components';

import { bindInstrumentComponent } from './InstrumentSurface.js';
import {
  aspectRatioFromLoad,
  DEFAULT_IMAGE_ASPECT_RATIO,
  resizeModeForFit,
} from './basicCatalogModel.js';
export { mobileBasicApis } from './componentApis.js';

/**
 * Mobile renderer implementations of the **upstream A2UI Basic Catalog**.
 *
 * These are not Gather Components. `Column`/`Text`/`Button`/`Image` are upstream
 * A2UI vocabulary that our React Native renderer has to support; the web
 * renderer gets the same components from `@a2ui/react`. Gather-defined
 * Composer primitives (`Flow`, `CameraView`, `MediaGallery`, …) are package-owned
 * in `gather-components` — see
 * docs/components-capabilities-ownership.md §10.
 *
 * The corollary: when mobile lacks an upstream component, implement it here.
 * Do **not** invent a Gather component (an `ImagePreview`) to work around it.
 */

const textVariantStyle = (variant) => {
  switch (variant) {
    case 'h1':
      return styles.h1;
    case 'h2':
      return styles.h2;
    case 'h3':
      return styles.h3;
    case 'h4':
    case 'h5':
      return styles.h4;
    case 'caption':
      return styles.caption;
    default:
      return styles.body;
  }
};

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
      return <RNText style={[textVariantStyle(variant), { color: theme.colors.text }]}>{text}</RNText>;
    }),
  },
  Image: {
    component: bindInstrumentComponent(ImageApi.schema, ({ url, description, fit }) => {
      const theme = useTheme();
      // The intrinsic ratio is only known once the image loads; until then the
      // slot holds a stable placeholder so the surface does not jump.
      const [aspectRatio, setAspectRatio] = useState(null);
      const onLoad = useCallback((event) => {
        const ratio = aspectRatioFromLoad(event);
        if (ratio) setAspectRatio(ratio);
      }, []);

      const uri = typeof url === 'string' && url.length > 0 ? url : null;
      if (!uri) return null;

      const label = typeof description === 'string' && description.length > 0 ? description : null;
      return (
        <RNImage
          source={{ uri }}
          style={[
            styles.image,
            { backgroundColor: theme.colors.surfaceMuted },
            { aspectRatio: aspectRatio ?? DEFAULT_IMAGE_ASPECT_RATIO },
          ]}
          resizeMode={resizeModeForFit(fit)}
          accessible={label !== null}
          accessibilityRole="image"
          accessibilityLabel={label ?? undefined}
          onLoad={onLoad}
        />
      );
    }),
  },
  Button: {
    component: bindInstrumentComponent(ButtonApi.schema, ({ action, child, variant, isValid, context, buildChild }) => {
      const mappedVariant = variant === 'primary' ? 'primary' : variant === 'borderless' ? 'borderless' : 'secondary';
      // Best-effort accessibility name from the child Text; the visible label is
      // always the rendered child, so mobile and web stay identical.
      const childText = child ? context?.surfaceComponents?.get(child)?.properties?.text : undefined;
      const label = typeof childText === 'string' ? childText : undefined;
      return (
        <SharedButton
          onPress={action}
          label={label}
          variant={mappedVariant}
          disabled={isValid === false}
          style={styles.button}
        >
          <View style={styles.buttonLabel}>{child ? buildChild(child) : null}</View>
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
  image: { width: '100%', borderRadius: tokens.radii.md, overflow: 'hidden' },
  button: { alignSelf: 'stretch' },
  buttonLabel: { alignItems: 'center' },
});
