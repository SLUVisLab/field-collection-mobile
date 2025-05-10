![EAS Build](https://github.com/SLUVislab/field-collection-mobile/actions/workflows/eas-build.yml/badge.svg?job=eas-build)
![Tests](https://github.com/SLUVislab/field-collection-mobile/actions/workflows/eas-build.yml/badge.svg?job=test)

# 📱 Gather

**Gather** is a modular mobile data collection platform designed for field research, ecological surveys, and flexible scientific use cases. Built using [React Native](https://reactnative.dev/) and powered by [Expo](https://docs.expo.dev/), it supports structured data entry through photos, videos, geolocation, and numerical input — all synced to a cloud backend.

> 🧪 Funded by the **National Science Foundation (NSF)**  
> 🔬 Developed by the **Saint Louis University Computer Vision Lab**  
> 🌱 In collaboration with the **[New Roots for Restoration Biology Integration Institute (NRR BII)](https://newroots.squarespace.com/)**

---

## 🚀 Features

- Offline-first mobile app for structured survey collection
- Supports photos, videos, maps, audio, numeric/text input
- On-device validation and conditional task logic
- Over-the-air (OTA) updates + internal distribution builds
- Integrates with EAS, Firebase, and MongoDB (configurable)

---

## 🛠 Getting Started

To run **Gather** locally, make sure you have [Node.js](https://nodejs.org/), [Expo CLI](https://docs.expo.dev/get-started/installation/), and [Yarn](https://classic.yarnpkg.com/en/docs/install/) installed.

### 1. Clone the Repo

```bash
git clone https://github.com/your-org/gather.git
cd gather
yarn install
```

### 2. Start the Development Server

```bash
npx expo start
```

Use the QR code in your terminal to open the app on a physical device **with a development build**.

📖 [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)

---

## 🔧 Building with EAS
We use [Expo Application Services (EAS)](https://docs.expo.dev/eas/) for production builds and OTA (over-the-air) updates.

### Common Build Commands
```bash
eas build --platform all --profile development
# or
eas build --platform all --profile testing
# or
eas build --platform all --profile production
```

### OTA Update Command
```bash
eas update --channel production --message "Update message here"
```

📖 [EAS Build Docs](https://docs.expo.dev/build/introduction/)
📖 [EAS Update Docs](https://docs.expo.dev/eas-update/introduction/)

### 📡 Distribution
Internal distribution builds are created for both Android and iOS platforms. You can access builds and install them via QR code links or download pages hosted in your team's documentation or GitHub Releases.

---

## 🛠️ Developer Notes

We follow a conventional Git workflow using feature branches and a linear commit history.

### Versioning & Automation
We use **[release-please](https://github.com/googleapis/release-please)** and **[Conventional Commits](https://www.conventionalcommits.org/)** to automate versioning, changelogs, and triggering builds via GitHub Actions.

- `feat:` → minor version bump (e.g., `1.2.0`)
- `fix:` → patch version bump (e.g., `1.2.1`)
- `feat!:` or `fix!:` → **major** version bump (e.g., `2.0.0`)

  ### Additional Commit Types
| Type       | Purpose                                                   |
|------------|-----------------------------------------------------------|
| `chore:`   | Routine tasks or maintenance (e.g., config updates)       |
| `docs:`    | Documentation changes only                                |
| `style:`   | Code style changes (e.g., formatting, whitespace)         |
| `refactor:`| Code changes that neither fix a bug nor add a feature     |
| `perf:`    | Changes that improve performance                          |
| `test:`    | Adding or refactoring tests (no production code changes)  |
| `ci:`      | Changes to CI/CD pipeline or workflow configuration       |
| `build:`   | Changes that affect the build system or dependencies      |

### Build Triggers
- Merging to `main`:
  - If the version ends in `.0` (e.g., `1.1.0`, `2.0.0`), a **production build** is triggered
  - Otherwise, an **OTA update** is triggered
- Merging to `development` triggers a **testing build**
- Opening a PR to `main` triggers a **testing build**
- Pushing to any branch named `feature/*` with `[build]` in the commit message triggers a **development build**

### Merge Strategy
We use **Rebase and Merge** to maintain a linear commit history, which is required for release-please to function correctly.

## 📚 Acknowledgments

This project is made possible through the support of the **NSF** and the **NRR Biology Integration Institute** and is part of ongoing research into scalable ecological monitoring and intelligent data workflows.

For collaboration inquiries, please contact austin.carnahan@slu.edu
