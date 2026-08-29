import {
  assertSerializableScientificValue,
  revisionFor,
  ScientificContractError,
} from '../contracts.js';

const requireString = (value, name) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ScientificContractError(`${name} must be a non-empty string.`);
  }
  return value;
};

export const createExecutionReceipt = ({
  capability,
  capabilityRevision,
  model = null,
  inputs,
  parameters = {},
  outputs,
  runtime,
  timestamp,
} = {}) => {
  assertSerializableScientificValue({ capability, capabilityRevision, model, inputs, parameters, outputs, runtime, timestamp });
  const receipt = {
    capability: requireString(capability, 'receipt.capability'),
    capabilityRevision: requireString(capabilityRevision, 'receipt.capabilityRevision'),
    model,
    inputs,
    parameters,
    outputs,
    runtime,
    timestamp: requireString(timestamp, 'receipt.timestamp'),
  };
  return { ...receipt, revision: revisionFor(receipt) };
};
