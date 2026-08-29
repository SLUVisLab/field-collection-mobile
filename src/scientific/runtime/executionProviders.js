export const executionProvidersFor = (platform) => {
  if (platform === 'ios') return ['coreml', 'xnnpack', 'cpu'];
  if (platform === 'android') return ['nnapi', 'xnnpack', 'cpu'];
  return ['cpu'];
};
