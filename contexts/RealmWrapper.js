import { AppProvider, UserProvider, RealmProvider } from '@realm/react';
import { OpenRealmBehaviorType, OpenRealmTimeOutBehavior, SyncError } from 'realm';
import React, { useState } from 'react';

import SurveyResults from '../models/SurveyResults';
import SurveyDesign from '../models/SurveyDesign';

import RealmLoading from '../screens/RealmLoading';
import LoginWrapper from '../screens/LoginWrapper';

const APP_ID = 'data-collection-0-pybsrtz';

const RealmWrapper = ({children}) => {

    const [syncError, setSyncError] = useState(null);
    const realmAccessBehavior = {
        type: OpenRealmBehaviorType.OpenImmediately,
    };

    return (
        <AppProvider id={APP_ID} logLevel={'trace'} logger={(level, message) => console.log(`[${level}]: ${message}`)}>
            <UserProvider fallback={LoginWrapper}>
                <RealmProvider
                    schema={[SurveyResults, SurveyDesign]}
                    fallback={<RealmLoading />}
                    sync={{
                    flexible: true,
                    existingRealmBehavior: realmAccessBehavior,
                    newRealmFileBehavior: realmAccessBehavior,
                    onError: (_, error) => {
                        setSyncError(error);
                        
                    },
                    initialSubscriptions: {
                        update(subs, realm) {
                        subs.add(realm.objects(SurveyDesign).filtered("name != nil"), {
                            name: "All Survey Designs",
                        });
                        },
                    },
                }}>
                    {children}
                </RealmProvider>
            </UserProvider>
        </AppProvider>

    );
}

export default RealmWrapper;