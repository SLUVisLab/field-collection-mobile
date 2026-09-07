/**
 * The Gather **compatibility report** — a reusable authoring primitive.
 *
 * Composes facts that already exist rather than validating anything itself:
 * `validateModelPackage` (recorded into the Model Catalog projection by the
 * authority that holds the package), a Capability's `acceptedModelProfiles`,
 * and what a given Gather distribution declares. Later consumers — the Model
 * Browser, a Tool readiness panel, form validation, a publish gate — render
 * this rather than each deriving their own verdict.
 *
 * ## Four kinds of evidence, deliberately not collapsed
 *
 * ```text
 * structural    does this package satisfy Gather's declared contracts?
 * capability    may this model satisfy this Capability?
 * availability  does this distribution actually ship it?
 * preview       did it execute here, and how honestly?
 * ```
 *
 * Availability is neither identity nor compatibility: a model can be perfectly
 * compatible and simply not shipped here, which is a packaging question, not an
 * incompatibility. And **preview evidence never makes compatibility more true**
 * — a simulated run is evidence about this renderer, not about the model. That
 * separation is what lets Phase 2 swap the preview backend to ORT-Web without
 * any verdict in this file changing meaning.
 *
 * ## What a verdict means
 *
 * A PASS means the model satisfies Gather's declared **portable** contracts —
 * package validity, task profile, capability acceptance. A successful browser
 * run means the model executed under Gather's web preview backend for one
 * sample. **Neither certifies native numerical parity, mobile performance,
 * power or thermal behaviour, or scientific suitability.** Native Gather
 * execution remains authoritative.
 */

/** Stable ids so a UI never parses English. */
export const CHECK_IDS = Object.freeze({
  packageValid: 'model.package.valid',
  revisionValid: 'model.revision.valid',
  profileAccepted: 'capability.profile.accepted',
  available: 'model.available',
  previewExecuted: 'preview.executed',
});

const REVISION = /^sha256:[a-f0-9]{64}$/;

const check = (id, status, message) => ({ id, status, message });

/** fail beats warning beats pass, and nothing else is consulted. */
const worst = (statuses) =>
  statuses.includes('fail') ? 'fail' : statuses.includes('warning') ? 'warning' : 'pass';

const sectionOf = (checks) => ({ status: worst(checks.map((c) => c.status)), checks });

/**
 * @param {{
 *   capabilityId: string,
 *   modelRef: { id?: string, revision?: string, taskProfile?: string }|null,
 *   definitions: Array<{ id: string, acceptedModelProfiles?: string[] }>,
 *   models: Array<{ modelRef: object, displayName?: string, taskProfile?: string,
 *                   structural?: { valid: boolean, problem: string|null } }>,
 *   previewEvidence?: { attempted: boolean, fidelity?: 'real'|'simulated',
 *                       backend?: string, status?: 'pass'|'fail' }|null,
 * }} input
 */
export const compatibilityFor = ({
  capabilityId,
  modelRef = null,
  definitions = [],
  models = [],
  previewEvidence = null,
} = {}) => {
  const definition = definitions.find((entry) => entry.id === capabilityId) ?? null;
  const accepted = definition?.acceptedModelProfiles ?? [];
  const declared = modelRef
    ? models.find((model) => model.modelRef.revision === modelRef.revision) ?? null
    : null;

  // An omitted modelRef is not an error: it means product policy chooses. The
  // report says what will happen rather than refusing to have an opinion.
  if (!modelRef) {
    const fallback = models.find((model) => (model.defaultFor ?? []).includes(capabilityId));
    const capability = sectionOf([
      fallback
        ? check(CHECK_IDS.profileAccepted, 'pass',
            `No model pinned; ${capabilityId} will use this distribution's default, ${fallback.displayName}.`)
        : check(CHECK_IDS.profileAccepted, accepted.length === 0 ? 'pass' : 'warning',
            accepted.length === 0
              ? `${capabilityId} needs no model.`
              : `${capabilityId} needs a model and this distribution declares no default.`),
    ]);
    return {
      subject: { capabilityId, modelRef: null },
      status: capability.status,
      structural: sectionOf([]),
      capability,
      availability: sectionOf([]),
      preview: previewSection(previewEvidence),
    };
  }

  // 1. structural — decided by whoever held the package, carried as a fact.
  const structuralChecks = [
    REVISION.test(modelRef.revision ?? '')
      ? check(CHECK_IDS.revisionValid, 'pass', 'Revision is a content digest.')
      : check(CHECK_IDS.revisionValid, 'fail', `"${modelRef.revision}" is not a sha256 content digest.`),
  ];
  if (declared?.structural) {
    structuralChecks.push(
      declared.structural.valid
        ? check(CHECK_IDS.packageValid, 'pass', 'Model package satisfies Gather’s declared contracts.')
        : check(CHECK_IDS.packageValid, 'fail', declared.structural.problem ?? 'Model package is invalid.')
    );
  } else {
    structuralChecks.push(
      check(CHECK_IDS.packageValid, 'warning',
        'No package is available here to validate, so structural validity is unknown.')
    );
  }

  // 2. capability — portable, and the only thing that can make this a FAIL.
  const profile = declared?.taskProfile ?? modelRef.taskProfile ?? null;
  const capabilityChecks = [
    !definition
      ? check(CHECK_IDS.profileAccepted, 'fail', `No capability "${capabilityId}" is declared.`)
      : accepted.length === 0
        ? check(CHECK_IDS.profileAccepted, 'warning', `${capabilityId} accepts no model profiles.`)
        : !profile
          ? check(CHECK_IDS.profileAccepted, 'warning', 'The model declares no task profile.')
          : accepted.includes(profile)
            ? check(CHECK_IDS.profileAccepted, 'pass', `${profile} is accepted by ${capabilityId}.`)
            : check(CHECK_IDS.profileAccepted, 'fail',
                `${profile} is not accepted by ${capabilityId}, which accepts ${accepted.join(', ')}.`),
  ];

  // 3. availability — a packaging question, never an incompatibility.
  const availabilityChecks = [
    declared
      ? check(CHECK_IDS.available, 'pass', 'This Gather distribution declares this exact revision.')
      : check(CHECK_IDS.available, 'warning',
          'This revision is not declared by this Gather distribution, so it would have to travel with the Tool.'),
  ];

  const structural = sectionOf(structuralChecks);
  const capability = sectionOf(capabilityChecks);
  const availability = sectionOf(availabilityChecks);

  return {
    subject: { capabilityId, modelRef },
    status: worst([structural.status, capability.status, availability.status]),
    structural,
    capability,
    availability,
    // Reported beside the verdict, never folded into it.
    preview: previewSection(previewEvidence),
  };
};

function previewSection(evidence) {
  if (!evidence?.attempted) {
    return {
      attempted: false,
      fidelity: null,
      backend: null,
      status: null,
      checks: [
        check(CHECK_IDS.previewExecuted, 'warning',
          'No browser preview run yet. This does not affect compatibility.'),
      ],
    };
  }
  const { fidelity = null, backend = null, status = 'pass' } = evidence;
  return {
    attempted: true,
    fidelity,
    backend,
    status,
    checks: [
      status === 'pass'
        ? check(CHECK_IDS.previewExecuted,
            fidelity === 'real' ? 'pass' : 'warning',
            fidelity === 'real'
              ? `Executed under ${backend ?? 'the browser preview backend'} for this sample. Native execution remains authoritative.`
              : `The preview ran a ${fidelity} implementation, which is evidence about this renderer and not about the model.`)
        : check(CHECK_IDS.previewExecuted, 'warning',
            `The browser preview failed under ${backend ?? 'the preview backend'}. This is evidence about the preview, not a compatibility verdict.`),
    ],
  };
}
