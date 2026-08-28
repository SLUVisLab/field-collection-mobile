import { registerRootComponent } from 'expo';

import M466UpdateSlice from './M466UpdateSlice';

// M4.6.6 entity-update (observation) gate. Prior gates (./M465RegisterSlice,
// ./M46EntitySlice, ./M45VerticalSlice, ./M44Smoke, ./App) are preserved.
registerRootComponent(M466UpdateSlice);
