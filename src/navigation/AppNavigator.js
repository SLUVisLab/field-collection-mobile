import { Navigate, Route, Routes } from 'react-router-native';

import { AndroidBackHandler } from './AndroidBackHandler.js';
import { BackGuardProvider } from './BackGuardContext.js';
import { ROUTES } from './routes.js';
import { SetupHome } from '../screens/setup/SetupHome.js';
import { SetupConnect } from '../screens/setup/SetupConnect.js';
import { SetupScan } from '../screens/setup/SetupScan.js';
import { ProjectHome } from '../screens/project/ProjectHome.js';
import { FormCatalog } from '../screens/project/FormCatalog.js';
import { FormRunner } from '../screens/project/FormRunner.js';
import { DraftsList } from '../screens/project/DraftsList.js';
import { InstanceDetail } from '../screens/project/InstanceDetail.js';
import { ProjectSwitch } from '../screens/project/ProjectSwitch.js';
import { FieldworkHome } from '../screens/project/FieldworkHome.js';
import { FieldworkSession } from '../screens/project/FieldworkSession.js';
import { SegmentAndMeasure } from '../screens/project/SegmentAndMeasure.js';

/**
 * Renders exactly one route tree for the given shell. The two trees are
 * mutually exclusive (setup when no project is active, project otherwise), so
 * unknown paths for the current shell redirect to that shell's root. The
 * hardware-back policy is mounted alongside the routes.
 *
 * This component only maps paths to screens — no bootstrap or storage logic.
 */
export function AppNavigator({ shell }) {
  return (
    <BackGuardProvider>
      <AndroidBackHandler />
      {shell === 'project' ? (
        <Routes>
          <Route path={ROUTES.project.home} element={<ProjectHome />} />
          <Route path={ROUTES.project.forms} element={<FormCatalog />} />
          <Route path={ROUTES.project.form} element={<FormRunner />} />
          <Route path={ROUTES.project.drafts} element={<DraftsList />} />
          <Route path={ROUTES.project.resume} element={<FormRunner />} />
          <Route path={ROUTES.project.instance} element={<InstanceDetail />} />
          <Route path={ROUTES.project.switch} element={<ProjectSwitch />} />
          <Route path={ROUTES.project.fieldwork} element={<FieldworkHome />} />
          <Route path={ROUTES.project.fieldworkSession} element={<FieldworkSession />} />
          <Route path={ROUTES.project.segmentMeasure} element={<SegmentAndMeasure />} />
          <Route path="*" element={<Navigate to={ROUTES.project.home} replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route path={ROUTES.setup.home} element={<SetupHome />} />
          <Route path={ROUTES.setup.connect} element={<SetupConnect />} />
          <Route path={ROUTES.setup.scan} element={<SetupScan />} />
          <Route path="*" element={<Navigate to={ROUTES.setup.home} replace />} />
        </Routes>
      )}
    </BackGuardProvider>
  );
}
