export const HIDDEN_XFORMS_SIDE_CAR_STYLE = Object.freeze({
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0.01,
  top: 0,
  left: 0,
});

export const createSidecarWebViewProps = ({
  html,
  onMessage,
  style = HIDDEN_XFORMS_SIDE_CAR_STYLE,
  sourceOverrides = {},
  ...rest
}) => ({
  source: {
    html,
    ...sourceOverrides,
  },
  originWhitelist: ['*'],
  onMessage,
  javaScriptEnabled: true,
  domStorageEnabled: true,
  allowFileAccess: true,
  allowUniversalAccessFromFileURLs: true,
  allowFileAccessFromFileURLs: true,
  style,
  ...rest,
});
