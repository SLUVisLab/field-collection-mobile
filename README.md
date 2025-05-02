# Roots for restoration

![EAS Build](https://github.com/SLUVislab/field-collection-mobile/actions/workflows/eas-build.yml/badge.svg)

roots and shoots and shoots and roots




download and run simulator build from eas (-p flag for platform)

`eas build:run -p ios`

launch metro server:

`npx expo start --dev-client`

send code to eas for build:

`eas build --profile testing --platform all`


iOS simulator failed to build:
try clearing the Developer Storage Cache Settings>General>Storage>Developer

and any xcode files in `~/Library/Caches/` and `~/Library/Developer/CoreSimulator/Caches/`
