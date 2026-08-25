import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';

export function useDataAPI() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Use environment variables for API configuration
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
  const API_KEY = import.meta.env.VITE_GATHER_HUB_API_KEY;
  
  // Helper function for API requests
  const callAPI = async (endpoint, method = 'GET', payload = null) => {
    if (!user) throw new Error("User not authenticated");
    
    const headers = {
      'Content-Type': 'application/json'
    };

    if (API_KEY) {
      headers['x-api-key'] = API_KEY;
    }

    const options = {
      method,
      headers
    };
    
    if (payload) {
      options.body = JSON.stringify(payload);
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "API request failed");
    }
    
    return response.json();
  };
  
  // Call MongoDB Data API through our proxy
  const callDataAPI = async (action, payload) => {
    return callAPI(`/mongodb/${action}`, 'POST', payload);
  };

  // Transform MongoDB document to frontend-friendly format
  const transformSurveyDocument = (doc) => {
    if (!doc) return null;

    const observationCount = typeof doc.observationCount === 'number'
      ? doc.observationCount
      : Array.isArray(doc.observations)
        ? doc.observations.length
        : 0;

    return {
      id: doc._id?.$oid || doc._id, // Convert MongoDB _id to string id
      name: doc.name || "Unnamed Survey",
      completedDate: doc.dateCompleted,
      observationCount,
      user: doc.user || "Not Listed",
      // Add other fields as needed
    };
  };

  // Transform collection documents for the UI
  const transformCollections = (collections) => {
    if (!collections || !collections.length) return [];
    
    return collections.map(col => ({
      id: col.ID,
      name: col.name,
      // Include other needed fields
    }));
  };

  // Search for surveys based on name pattern
  const searchSurveys = useCallback(async (nameQuery) => {
    if (!user) return [];
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await callDataAPI('find', {
        filter: { 
          name: { $regex: nameQuery, $options: "i" }
        },
        projection: {
          _id: 1,
          name: 1,
          dateCompleted: 1,
          observations: { $size: "$observations" } // Count observations
        },
        limit: 10 // Limit results for performance
      });
      
      return (result.documents || []).map(transformSurveyDocument);
    } catch (err) {
      setError(err.message);
      console.error("Search surveys error:", err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Get "survey collections" for a specific survey
  const getSurveyCollections = useCallback(async (surveyId) => {
    if (!user || !surveyId) return [];
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await callDataAPI('findOne', {
        filter: { 
          _id: { $oid: surveyId }
        },
        projection: { collections: 1 }
      });
      
      return transformCollections(result.document?.collections || []);
    } catch (err) {
      setError(err.message);
      console.error("Get survey collections error:", err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Get surveys filtered by all criteria
  const getFilteredSurveys = useCallback(async (surveyName, collections = []) => {
    if (!user) return [];
    setIsLoading(true);
    setError(null);
    
    try {
      // Build filter based on provided criteria
      const filter = {};
      
      if (surveyName) {
        filter.name = surveyName;
      }
      
      // Collection filtering
      if (collections && collections.length) {
        filter["collections"] = {
          $elemMatch: {
            ID: { $in: collections }
          }
        };
      }
      
      const pipeline = [];

      if (Object.keys(filter).length) {
        pipeline.push({ $match: filter });
      }

      pipeline.push({
        $project: {
          _id: 1,
          name: 1,
          dateCompleted: 1,
          observationCount: {
            $size: { $ifNull: ["$observations", []] }
          },
          user: { $ifNull: ["$user", "Not Listed"] }
        }
      });

      const result = await callDataAPI('aggregate', {
        pipeline
      });

      return (result.documents || []).map(transformSurveyDocument);
    } catch (err) {
      setError(err.message);
      console.error("Get filtered surveys error:", err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const getSurveyNames = useCallback(async () => {
    if (!user) return [];
    setIsLoading(true);
    setError(null);

    try {
      const result = await callDataAPI('aggregate', {
        pipeline: [
          { $match: { name: { $exists: true, $ne: '' } } },
          { $group: { _id: '$name', firstSurveyId: { $first: '$_id' } } },
          {
            $project: {
              _id: 0,
              name: '$_id',
              surveyId: {
                $cond: {
                  if: { $ifNull: ['$firstSurveyId', false] },
                  then: { $toString: '$firstSurveyId' },
                  else: null
                }
              },
              firstSurveyId: '$firstSurveyId'
            }
          },
          { $sort: { name: 1 } }
        ]
      });

      return (result.documents || []).map(doc => ({
        id: doc.surveyId || doc.firstSurveyId?.$oid || doc.firstSurveyId,
        name: doc.name
      })).filter(option => option.id && option.name);
    } catch (err) {
      setError(err.message);
      console.error("Get survey names error:", err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Start export process for selected surveys
  const startExport = useCallback(async (surveyIds, { includeMedia, format } = {}) => {
    if (!user || !surveyIds.length) return null;
    setIsLoading(true);
    setError(null);
    
    try {
      // Start the export process
      const payload = { surveyIds };

      if (typeof includeMedia === 'boolean') {
        payload.includeMedia = includeMedia;
      }

      if (typeof format === 'string' && format.trim() !== '') {
        payload.format = format;
      } else {
        payload.format = 'json';
      }

      const result = await callAPI('/export/surveys', 'POST', payload);
      
      return result; // Returns job information including jobId
    } catch (err) {
      setError(err.message);
      console.error("Start export error:", err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Check export status
  const checkExportStatus = useCallback(async (jobId) => {
    if (!user || !jobId) return null;
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await callAPI(`/export/status/${jobId}`);
      
      return result;
    } catch (err) {
      setError(err.message);
      console.error("Check export status error:", err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return {
    searchSurveys,
    getSurveyCollections,
    getFilteredSurveys,
    startExport,
    checkExportStatus,
    getSurveyNames,
    isLoading,
    error
  };
}