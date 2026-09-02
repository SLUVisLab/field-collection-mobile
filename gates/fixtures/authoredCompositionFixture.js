/**
 * An **authored** composition — the kind a researcher would produce in Composer.
 *
 * Deliberately hand-written data with no imports from app code: it is form
 * content, not application source. Nothing here is registered, and there is no
 * handler anywhere in the build for `authored_photo_v1`. Its entire behaviour is
 * ordinary A2UI wiring:
 *
 * ```text
 * CameraView            capture → /working/capture      (Component output binding)
 * "Save photo" Button   gather_persistAsset(capture)  → resultPath /working/image
 * "Accept" Button       gather_completeComposition({ outputs: { image, note } })
 * ```
 *
 * One interaction → one FunctionCall → one optional result write, throughout.
 * The separate "Save photo" step is deliberate: it keeps the proof within the
 * semantics we actually support, rather than assuming sequencing we have not
 * built.
 */
export const AUTHORED_COMPOSITION_ID = 'authored_photo_v1';
export const AUTHORED_COMPOSITION_FILENAME = `${AUTHORED_COMPOSITION_ID}.a2ui.json`;

const SURFACE_ID = 'authored-photo';

export const AUTHORED_COMPOSITION_DEFINITION = {
  id: AUTHORED_COMPOSITION_ID,
  revision: '1.0.0',
  title: 'Authored photo',
  description: 'Capture a photo, make it durable, and submit it — no app code.',
  catalogId: 'https://gather.slu.edu/a2ui/catalogs/v0.1.json',
  surfaceId: SURFACE_ID,
  statePath: '/working',
  result: {
    kind: 'object',
    outputs: [
      { path: 'image', type: 'object', required: true },
      { path: 'note', type: 'string', required: false },
    ],
  },
  messages: [
    {
      version: 'v0.9',
      createSurface: {
        surfaceId: SURFACE_ID,
        catalogId: 'https://gather.slu.edu/a2ui/catalogs/v0.1.json',
        sendDataModel: true,
      },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: SURFACE_ID,
        components: [
          {
            id: 'root',
            component: 'Column',
            children: ['title', 'camera', 'saveButton', 'savedText', 'acceptButton'],
          },
          { id: 'title', component: 'Text', text: 'Authored photo', variant: 'h3' },

          // Component output → composition state, via the upstream binder
          // setter. No handler receives an event.
          { id: 'camera', component: 'CameraView', capture: { path: '/working/capture' } },

          {
            id: 'saveButton',
            component: 'Button',
            variant: 'primary',
            child: 'saveLabel',
            action: {
              functionCall: {
                call: 'gather_persistAsset',
                args: { capture: { path: '/working/capture' }, retention: 'keep' },
              },
              resultPath: '/working/image',
            },
          },
          { id: 'saveLabel', component: 'Text', text: 'Save photo', variant: 'body' },

          // Proves the persisted asset reached composition state.
          { id: 'savedText', component: 'Text', text: { path: '/working/image/assetId' }, variant: 'body' },

          {
            id: 'acceptButton',
            component: 'Button',
            variant: 'primary',
            child: 'acceptLabel',
            action: {
              functionCall: {
                call: 'gather_completeComposition',
                args: {
                  outputs: {
                    image: { path: '/working/image' },
                    note: { path: '/working/note' },
                  },
                },
              },
            },
          },
          { id: 'acceptLabel', component: 'Text', text: 'Accept and submit', variant: 'body' },
        ],
      },
    },
    {
      version: 'v0.9',
      updateDataModel: {
        surfaceId: SURFACE_ID,
        path: '/working',
        value: { capture: null, image: null, note: 'authored' },
      },
    },
  ],
};

/** The form's binding manifest: it owns where outputs land, and the projection. */
export const AUTHORED_COMPOSITION_MANIFEST = {
  version: 1,
  fields: [
    {
      reference: '/data/photo',
      composition: AUTHORED_COMPOSITION_ID,
      definition: AUTHORED_COMPOSITION_FILENAME,
      bindings: [
        // `media` is what promotes the durable asset into a real ODK
        // attachment at completion. The composition never learns about that.
        { path: 'image', reference: '/data/photo/image', required: true, projection: 'media' },
        { path: 'note', reference: '/data/photo/note' },
      ],
    },
  ],
};

/** Ordinary writable backing fields, so other ODK clients degrade gracefully. */
export const AUTHORED_FORM_ID = 'dev_seed_authored_photo';

export const AUTHORED_FORM_XML = `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">
  <h:head><h:title>Authored photo (dev seed)</h:title><model>
    <instance><data id="${AUTHORED_FORM_ID}">
      <site_name/>
      <photo>
        <note/>
        <image/>
      </photo>
      <meta><instanceID/></meta>
    </data></instance>
    <bind nodeset="/data/site_name" type="string"/>
    <bind nodeset="/data/photo/note" type="string"/>
    <bind nodeset="/data/photo/image" type="binary"/>
    <bind nodeset="/data/meta/instanceID" type="string" jr:preload="uid"/>
  </model></h:head>
  <h:body>
    <input ref="/data/site_name"><label>Site name</label></input>
    <group ref="/data/photo" appearance="gather-composition:${AUTHORED_COMPOSITION_ID}">
      <label>Photo</label>
      <input ref="/data/photo/note"><label>Note</label></input>
      <upload ref="/data/photo/image" mediatype="image/*"><label>Image</label></upload>
    </group>
  </h:body>
</h:html>`;
