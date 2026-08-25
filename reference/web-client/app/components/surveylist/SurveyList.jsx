import { useState } from 'react';
import styles from './SurveyList.module.css';

export default function SurveyList({ 
  surveys, 
  selectedSurveys, 
  onSurveySelect, 
  onDownload, 
  isLoading,
  isExporting,
  exportStatus
}) {
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  const renderExportStatus = () => {
    if (!exportStatus) return null;

    const {
      status,
      message,
      progress,
      downloadUrl,
      displayName,
      aggregatedCount,
      observationCount
    } = exportStatus;

    const progressValue = Math.round(Math.max(0, Math.min(100, progress ?? 0)));
    const hasMetaInfo =
      typeof aggregatedCount === 'number' || typeof observationCount === 'number';

    if (status === 'processing') {
      return (
        <div className={styles.exportStatus}>
          <div className={styles.exportStatusHeader}>
            <span>{message || 'Processing export'}</span>
            <span className={styles.exportStatusPercent}>{progressValue}%</span>
          </div>
          <div className={styles.exportProgressBar}>
            <div
              className={styles.exportProgressFill}
              style={{ width: `${progressValue}%` }}
            ></div>
          </div>
          {hasMetaInfo && (
            <div className={styles.exportStatusMeta}>
              {typeof aggregatedCount === 'number' && (
                <span>{aggregatedCount.toLocaleString()} surveys</span>
              )}
              {typeof observationCount === 'number' && (
                <span>{observationCount.toLocaleString()} observations</span>
              )}
            </div>
          )}
        </div>
      );
    }

    if (status === 'complete') {
      return (
        <div className={styles.exportStatus}>
          <div className={styles.exportStatusHeader}>
            <span>
              Export ready{displayName ? `: ${displayName}` : ''}
            </span>
          </div>
          {hasMetaInfo && (
            <div className={styles.exportStatusMeta}>
              {typeof aggregatedCount === 'number' && (
                <span>{aggregatedCount.toLocaleString()} surveys</span>
              )}
              {typeof observationCount === 'number' && (
                <span>{observationCount.toLocaleString()} observations</span>
              )}
            </div>
          )}
          {downloadUrl && (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              className={styles.exportDownloadLink}
            >
              Download {displayName || 'export'}
            </a>
          )}
        </div>
      );
    }

    if (status === 'error') {
      return (
        <div className={`${styles.exportStatus} ${styles.exportStatusError}`}>
          <span>{message || 'Export failed. Please try again.'}</span>
        </div>
      );
    }

    return (
      <div className={styles.exportStatus}>
        <span>{message || status}</span>
      </div>
    );
  };
  
  // Handle sort changes
  const handleSort = (field) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  // Select all surveys
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      // Select all surveys
      onSurveySelect(surveys.map(survey => survey.id), true);
    } else {
      // Deselect all
      onSurveySelect([], false);
    }
  };
  
  // Sort surveys based on current sort settings
  const sortedSurveys = [...surveys].sort((a, b) => {
    let valueA, valueB;
    
    // Extract values based on sort field
    switch(sortField) {
      case 'name':
        valueA = a.name?.toLowerCase() || '';
        valueB = b.name?.toLowerCase() || '';
        break;
      case 'observations':
        valueA = a.observationCount || 0;
        valueB = b.observationCount || 0;
        break;
      case 'date':
        valueA = a.completedDate ? new Date(a.completedDate).getTime() : 0;
        valueB = b.completedDate ? new Date(b.completedDate).getTime() : 0;
        break;
      case 'user':
        valueA = a.user?.toLowerCase() || '';
        valueB = b.user?.toLowerCase() || '';
        break;
      default:
        valueA = a.name?.toLowerCase() || '';
        valueB = b.name?.toLowerCase() || '';
    }
    
    // Compare based on direction
    const compareResult = valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
    return sortDirection === 'asc' ? compareResult : -compareResult;
  });
  
  // Check if all surveys are selected
  const allSelected = surveys.length > 0 && selectedSurveys.length === surveys.length;
  
  // Show loading state
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loader}></div>
        <p>Loading surveys...</p>
      </div>
    );
  }
  
  // Show empty state if no surveys
  if (surveys.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No surveys found</p>
        <p className={styles.emptyStateHelp}>
          Try different search criteria or select a different survey
        </p>
      </div>
    );
  }
  
  return (
    <div className={styles.listContainer}>
      <div className={styles.listHeader}>
        <h2 className={styles.resultsTitle}>
          Found {surveys.length} {surveys.length === 1 ? 'Survey' : 'Surveys'}
        </h2>
        
        <div className={styles.actionBar}>
          <span className={styles.selectedCount}>
            {selectedSurveys.length} selected
          </span>
          <div className={styles.exportControls}>
            <button
              className={styles.downloadButton}
              disabled={selectedSurveys.length === 0 || isExporting}
              onClick={onDownload}
            >
              {isExporting ? 'Processing...' : 'Download Selected'}
            </button>
            {renderExportStatus()}
          </div>
        </div>
      </div>
      
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.checkboxCell}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className={styles.checkbox}
                  disabled={isExporting}
                />
              </th>
              <th 
                className={`${styles.headerCell} ${sortField === 'name' ? styles.sorted : ''}`} 
                onClick={() => handleSort('name')}
              >
                <div className={styles.headerContent}>
                  Survey Name
                  <span className={styles.sortIcon}>
                    {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </span>
                </div>
              </th>
              <th 
                className={`${styles.headerCell} ${styles.centerAlign} ${sortField === 'observations' ? styles.sorted : ''}`}
                onClick={() => handleSort('observations')}
              >
                <div className={styles.headerContent}>
                  Observations
                  <span className={styles.sortIcon}>
                    {sortField === 'observations' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </span>
                </div>
              </th>
              <th 
                className={`${styles.headerCell} ${sortField === 'date' ? styles.sorted : ''}`}
                onClick={() => handleSort('date')}
              >
                <div className={styles.headerContent}>
                  Completion Date
                  <span className={styles.sortIcon}>
                    {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </span>
                </div>
              </th>
              <th
                className={`${styles.headerCell} ${sortField === 'user' ? styles.sorted : ''}`}
                onClick={() => handleSort('user')}
              >
                <div className={styles.headerContent}>
                  User
                  <span className={styles.sortIcon}>
                    {sortField === 'user' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedSurveys.map(survey => (
              <tr key={survey.id} className={styles.tableRow}>
                <td className={styles.checkboxCell}>
                  <input
                    type="checkbox"
                    checked={selectedSurveys.includes(survey.id)}
                    onChange={(e) => onSurveySelect(survey.id, e.target.checked)}
                    className={styles.checkbox}
                    disabled={isExporting}
                  />
                </td>
                <td className={styles.nameCell}>{survey.name}</td>
                <td className={styles.observationsCell}>
                  {survey.observationCount ? survey.observationCount.toLocaleString() : 0}
                </td>
                <td className={styles.dateCell}>
                  {formatDate(survey.completedDate)}
                </td>
                <td className={styles.userCell}>
                  {survey.user || 'Not Listed'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}