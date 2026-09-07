import { digestCanonical } from 'gather-hashing';

import { assertSerializableValue } from './serializable.js';

/**
 * A receipt could not be minted. Its own domain error: an execution receipt
 * missing its capability is a provenance problem, not a canonicalization one.
 */
export class ProvenanceError extends Error {
  constructor(message, { code = 'GATHER_PROVENANCE_ERROR', cause = null } = {}) {
    super(message);
    this.name = 'ProvenanceError';
    this.code = code;
    this.cause = cause;
  }
}

const requireString = (value, name) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ProvenanceError(`${name} must be a non-empty string.`);
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
  assertSerializableValue({ capability, capabilityRevision, model, inputs, parameters, outputs, runtime, timestamp });
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
  return { ...receipt, revision: digestCanonical(receipt) };
};
