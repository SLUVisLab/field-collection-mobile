export type UsageKind = 'call' | 'get' | 'set' | 'new' | 'instanceof';

export interface RequirementRecord {
  interface: string;
  member: string;
  categories: string[];
  usageKinds: UsageKind[];
  sourcePackages: string[];
  sources: string[];
}

export interface StaticArtifact {
  metadata: {
    generatedAt: string;
    engineVersion: string;
    engineRoot: string;
    xpathMode: 'vendored-source' | 'bundled-dist-only';
    filesScanned: number;
    scanner: 'ts-morph';
  };
  requirements: RequirementRecord[];
}

export interface DynamicRequirement {
  interface: string;
  member: string;
  usageKinds: UsageKind[];
  count: number;
  sampleStacks: string[];
}

export interface DynamicArtifact {
  metadata: {
    generatedAt: string;
    engineVersion: string;
    fixturePath: string;
    status: 'ok' | 'error';
    error?: {
      name: string;
      message: string;
      stack?: string;
    };
  };
  requirements: DynamicRequirement[];
}
