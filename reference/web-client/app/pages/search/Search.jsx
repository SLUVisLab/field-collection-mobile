import { useState, useEffect, useRef, useCallback } from 'react';
import { useDataAPI } from '../../hooks/useDataAPI';
import SearchForm from '../../components/searchform/SearchForm';
import SurveyList from '../../components/surveylist/SurveyList';
import styles from './Search.module.css';

export default function Search() {
  // State for search parameters
  const [selectedSurveyId, setSelectedSurveyId] = useState('');
  const [selectedSurveyName, setSelectedSurveyName] = useState('');
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [dateRange, setDateRange] = useState({ startDate: null, endDate: null });
  const [availableCollections, setAvailableCollections] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [surveyNames, setSurveyNames] = useState([]);
  const [allSurveys, setAllSurveys] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [includeMedia, setIncludeMedia] = useState(false);
  const [fileFormat, setFileFormat] = useState('json');
  
  // State for results and selection
  const [surveys, setSurveys] = useState([]);
  const [selectedSurveys, setSelectedSurveys] = useState([]);
  const [exportStatus, setExportStatus] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const exportAbortRef = useRef(null);

  const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace(/\/$/, '');
  const API_KEY = import.meta.env.VITE_GATHER_HUB_API_KEY;
  
  const { 
    getSurveyCollections, 
    getFilteredSurveys, 
    startExport,
    getSurveyNames,
    isLoading, 
    error 
  } = useDataAPI();

  useEffect(() => {
    const loadSurveyNames = async () => {
      const names = await getSurveyNames();
      setSurveyNames(names);
    };

    loadSurveyNames();
  }, [getSurveyNames]);

  // When survey id changes, fetch available collections
  useEffect(() => {
    if (selectedSurveyId) {
      const fetchCollections = async () => {
        const collections = await getSurveyCollections(selectedSurveyId);
        setAvailableCollections(collections);
      };
      fetchCollections();
    } else {
      setAvailableCollections([]);
      setSelectedCollections([]);
    }
  }, [selectedSurveyId, getSurveyCollections]);

  // When any filter changes, update the results
  useEffect(() => {
    if (!selectedSurveyName) {
      setAllSurveys([]);
      setSurveys([]);
      setSelectedSurveys([]);
      setAvailableUsers([]);
      setSelectedUser('');
  setIncludeMedia(false);
  setFileFormat('json');
      setExportStatus(null);
      if (exportAbortRef.current) {
        exportAbortRef.current.abort();
        exportAbortRef.current = null;
      }
      setIsExporting(false);
      return;
    }

    let isMounted = true;

    const fetchSurveys = async () => {
      const results = await getFilteredSurveys(selectedSurveyName, selectedCollections);
      if (!isMounted) return;
      setAllSurveys(results);
      setSelectedSurveys([]);
  setExportStatus(null);
      if (exportAbortRef.current) {
        exportAbortRef.current.abort();
        exportAbortRef.current = null;
      }
      setIsExporting(false);
      setIncludeMedia(false);
      setFileFormat('json');
      const uniqueUsers = Array.from(new Set(results.map(({ user }) => user || 'Not Listed')));
      setAvailableUsers(uniqueUsers);
      setSelectedUser(prev => (prev && !uniqueUsers.includes(prev) ? '' : prev));
    };

    fetchSurveys();

    return () => {
      isMounted = false;
    };
  }, [selectedSurveyName, selectedCollections, getFilteredSurveys]);

  useEffect(() => {
    if (!allSurveys.length) {
      setSurveys([]);
      setSelectedSurveys([]);
      return;
    }

    const startBoundary = dateRange.startDate
      ? new Date(dateRange.startDate).setHours(0, 0, 0, 0)
      : null;
    const endBoundary = dateRange.endDate
      ? new Date(dateRange.endDate).setHours(23, 59, 59, 999)
      : null;

    let filtered = allSurveys;

    if (selectedUser) {
      filtered = filtered.filter(({ user }) => (user || 'Not Listed') === selectedUser);
    }

    const dateFiltered = filtered.filter(({ completedDate }) => {
      if (!completedDate) return false;

      const completionTime = new Date(completedDate).getTime();
      if (Number.isNaN(completionTime)) return false;

      if (startBoundary !== null && completionTime < startBoundary) return false;
      if (endBoundary !== null && completionTime > endBoundary) return false;

      return true;
    });

    const hasDateFilters = startBoundary !== null || endBoundary !== null;
    const finalResults = hasDateFilters ? dateFiltered : filtered;

    setSurveys(finalResults);
    setSelectedSurveys(prev =>
      prev.filter(id => finalResults.some(survey => survey.id === id))
    );
  }, [allSurveys, dateRange.startDate, dateRange.endDate, selectedUser]);

  useEffect(() => {
    return () => {
      if (exportAbortRef.current) {
        exportAbortRef.current.abort();
      }
    };
  }, []);

  const waitForExportCompletion = useCallback(async ({
    jobId,
    statusCheckPath,
    intervalMs = 5000,
    signal,
    onProgress = () => {}
  }) => {
    if (!jobId || !statusCheckPath) {
      throw new Error('Export job information is missing.');
    }

    const endpoint = `${API_BASE_URL}${statusCheckPath}`;

    const headers = API_KEY ? { 'x-api-key': API_KEY } : {};

    while (true) {
      if (signal?.aborted) {
        throw new DOMException('Export polling aborted', 'AbortError');
      }

      const response = await fetch(endpoint, {
        method: 'GET',
        headers,
        signal
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Status check failed: ${response.status}`);
      }

      const status = await response.json();

      onProgress({
        status: status.status,
        progress: status.progress ?? 0,
        aggregatedCount: status.aggregatedSurveyCount,
        observationCount: status.observationCount,
        displayName: status.displayName,
        downloadUrl: status.downloadUrl
      });

      if (status.status === 'complete') {
        return status;
      }

      if (status.status === 'error') {
        throw new Error(status.error || 'Export failed');
      }

      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          if (signal) {
            signal.removeEventListener('abort', handleAbort);
          }
          resolve();
        }, intervalMs);

        const handleAbort = () => {
          clearTimeout(timeoutId);
          if (signal) {
            signal.removeEventListener('abort', handleAbort);
          }
          reject(new DOMException('Export polling aborted', 'AbortError'));
        };

        if (signal) {
          signal.addEventListener('abort', handleAbort);
        }
      });
    }
  }, [API_BASE_URL, API_KEY]);

  // Handle survey selection
  const handleSurveySelect = (surveyId, isSelected) => {
    setSelectedSurveys(prev => {
      if (Array.isArray(surveyId)) {
        // Handling select all case
        return isSelected ? surveyId : [];
      } else {
        // Handling single selection
        if (isSelected) {
          return [...prev, surveyId];
        } else {
          return prev.filter(id => id !== surveyId);
        }
      }
    });
  };

  // Handle survey name change from the search form
  const handleSurveyChange = (id, name) => {
    setSelectedSurveyId(id);
    setSelectedSurveyName(name);
    setSelectedUser('');
    setAvailableUsers([]);
    setIncludeMedia(false);
    setFileFormat('json');
  }

  const handleClearFilters = () => {
    setDateRange({ startDate: null, endDate: null });
    setSelectedCollections([]);
    setSelectedUser('');
    setIncludeMedia(false);
  setFileFormat('json');
    setExportStatus(null);
    if (exportAbortRef.current) {
      exportAbortRef.current.abort();
      exportAbortRef.current = null;
    }
    setIsExporting(false);
  };

  // Handle download action
  const handleDownload = async () => {
    if (selectedSurveys.length === 0 || isExporting) return;

    setExportStatus({
      status: 'processing',
      progress: 0,
      message: 'Preparing export...',
      aggregatedCount: null,
      observationCount: null,
      downloadUrl: null,
      displayName: null
    });

    setIsExporting(true);

    try {
      const job = await startExport(selectedSurveys, {
        includeMedia,
        format: fileFormat || 'json'
      });

      if (!job || !job.jobId) {
        throw new Error('Failed to start export job.');
      }

      const controller = new AbortController();
      exportAbortRef.current = controller;

      const result = await waitForExportCompletion({
        jobId: job.jobId,
        statusCheckPath: job.statusCheckPath,
        signal: controller.signal,
        onProgress: ({ progress, status, aggregatedCount, observationCount, displayName }) => {
          setExportStatus(prev => ({
            ...prev,
            status,
            progress: Math.max(0, Math.min(100, progress ?? 0)),
            message: status === 'complete' ? 'Complete' : status,
            aggregatedCount,
            observationCount,
            displayName,
            downloadUrl: null
          }));
        }
      });

      setExportStatus(prev => ({
        ...prev,
        status: 'complete',
        progress: 100,
        message: 'Export complete',
        downloadUrl: result.downloadUrl,
        displayName: result.displayName,
        aggregatedCount: result.aggregatedSurveyCount,
        observationCount: result.observationCount
      }));
    } catch (err) {
      if (err.name === 'AbortError') {
        return;
      }

      setExportStatus({
        status: 'error',
        progress: 0,
        message: err.message || 'Export failed',
        aggregatedCount: null,
        observationCount: null,
        downloadUrl: null,
        displayName: null
      });
    } finally {
      setIsExporting(false);
      exportAbortRef.current = null;
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Survey Search</h1>
      
      <SearchForm
        surveyName={selectedSurveyName}
        onSurveyNameChange={handleSurveyChange}
        selectedCollections={selectedCollections}
        onCollectionsChange={setSelectedCollections}
        availableCollections={availableCollections}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        surveyNames={surveyNames}
        selectedUser={selectedUser}
        onUserChange={setSelectedUser}
        userOptions={availableUsers}
        includeMedia={includeMedia}
        onIncludeMediaChange={setIncludeMedia}
        fileFormat={fileFormat}
        onFileFormatChange={setFileFormat}
        onClearFilters={handleClearFilters}
      />
      
      {error && <div className={styles.error}>{error}</div>}
      
      <SurveyList
        surveys={surveys}
        selectedSurveys={selectedSurveys}
        onSurveySelect={handleSurveySelect}
        onDownload={handleDownload}
        isLoading={isLoading}
        isExporting={isExporting}
        exportStatus={exportStatus}
      />
    </div>
  );
}