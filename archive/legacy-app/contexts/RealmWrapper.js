import { RealmProvider } from '@realm/react';
import React from 'react';

import SurveyDesign from '../models/SurveyDesign';

import RealmLoading from '../screens/RealmLoading';
import LoginWrapper from '../screens/LoginWrapper';
import { AuthProvider, useAuth } from './AuthContext';

const AuthGate = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return <RealmLoading />;
    }

    if (!isAuthenticated) {
        return <LoginWrapper />;
    }

    return (
        <RealmProvider schema={[SurveyDesign]} fallback={<RealmLoading />}>
            {children}
        </RealmProvider>
    );
};

const RealmWrapper = ({ children }) => (
    <AuthProvider>
        <AuthGate>{children}</AuthGate>
    </AuthProvider>
);

export default RealmWrapper;