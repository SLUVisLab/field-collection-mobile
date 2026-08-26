import { registerRootComponent } from 'expo';

// Install DOM compatibility globals before any module that imports the engine.
import './src/installDomFirst';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
