import crashlytics from '@react-native-firebase/crashlytics';

export const LogService = {
  // Initialize crashlytics with user info if available
  init: async (userData = null) => {
    try {
      // Set user ID if available
      if (userData?.uid) {
        await crashlytics().setUserId(userData.uid);
      }
    } catch (error) {
      console.error('Failed to initialize Crashlytics:', error);
    }
  },

  // Log generic error with context
  logError: async (error, context = {}) => {
    try {
      // Record custom keys for this error
      Object.keys(context).forEach(key => {
        crashlytics().setAttribute(key, String(context[key]));
      });
      
      // Log a message about the error
      crashlytics().log(`Error occurred: ${error.message}`);
      
      // Record the actual error to Crashlytics
      crashlytics().recordError(error);
    } catch (e) {
      console.error('Failed to log error to Crashlytics:', e);
    }
  },

  // Log upload issues specifically
  logUploadIssue: async (surveyKey, stage, error, details = {}) => {
    try {
      // Record upload-specific attributes
      crashlytics().setAttribute('upload_stage', stage);
      crashlytics().setAttribute('survey_key', surveyKey || 'unknown');
      
      // Add any other details as attributes
      Object.entries(details).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          crashlytics().setAttribute(key, String(value));
        }
      });
      
      // Record the error
      if (error) {
        crashlytics().recordError(error);
      } else {
        crashlytics().recordError(new Error(`Upload failed at ${stage}`));
      }
    } catch (e) {
      console.error('Failed to log upload issue:', e);
    }
  }
};