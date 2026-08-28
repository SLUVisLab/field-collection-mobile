import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useXFormsQuestion } from 'odk-xforms-react';

import { CameraCapture } from '../../components/camera/CameraCapture.js';
import { CameraControls } from '../../components/camera/CameraControls.js';
import { ActionButton } from '../../components/NavButton.js';
import { ImagePreview } from '../../components/camera/ImagePreview.js';
import { FormField } from '../../components/forms/FormField.js';
import { ReadonlyValue } from '../../components/forms/ReadonlyValue.js';
import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';

const textValue = (value) => {
  if (Array.isArray(value)) return value.map(String).join(' ');
  return value == null ? '' : String(value);
};

export function XFormsImageControl({ node, indent, onLayout, onAttachImage, attachBusy }) {
  const question = useXFormsQuestion(node.reference);
  const [showCamera, setShowCamera] = useState(false);
  const [capture, setCapture] = useState(null);
  const label = node.label ?? node.reference;
  const theme = useTheme();

  if (question.readonly) {
    return (
      <FormField label={label} indent={indent} onLayout={onLayout}>
        <ReadonlyValue value={question.value} />
      </FormField>
    );
  }

  const filename = textValue(question.instanceValue);
  const attachCapture = async () => {
    if (!capture || attachBusy) return;
    const attached = await onAttachImage?.(node, capture);
    if (attached) setCapture(null);
  };

  return (
    <FormField
      label={label}
      hint={node.hint}
      required={question.required === true}
      indent={indent}
      onLayout={onLayout}
    >
      <Text style={[styles.uploadStatus, { color: theme.colors.text, fontSize: tokens.typography.helper }]}>
        {filename ? `Attached: ${filename}` : 'No local image is attached.'}
      </Text>
      {showCamera ? (
        <CameraCapture
          onCaptured={(nextCapture) => {
            setCapture(nextCapture);
            setShowCamera(false);
          }}
          onCancel={() => setShowCamera(false)}
          testIDPrefix={`capture-image-${node.reference}`}
        />
      ) : capture ? (
        <View style={[styles.capturePreview, { gap: tokens.spacing.sm }]}>
          <ImagePreview uri={capture.uri} />
          <CameraControls
            captureLabel={attachBusy ? 'Attaching…' : 'Use this photo'}
            captureDisabled={attachBusy}
            onCapture={attachCapture}
            onCancel={() => {
              setCapture(null);
              setShowCamera(true);
            }}
            cancelLabel="Retake photo"
            testIDPrefix={`captured-image-${node.reference}`}
          />
        </View>
      ) : (
        <ActionButton
          label="Take photo"
          onPress={() => setShowCamera(true)}
          disabled={attachBusy}
          style={styles.inlineAction}
          testID={`capture-image-${node.reference}`}
          variant="secondary"
        />
      )}
    </FormField>
  );
}

const styles = StyleSheet.create({
  uploadStatus: {},
  capturePreview: {},
  inlineAction: { alignSelf: 'flex-start' },
});
