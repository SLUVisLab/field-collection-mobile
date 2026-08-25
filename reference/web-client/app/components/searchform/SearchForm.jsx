import { useState, useEffect, useRef } from 'react';
import { useDataAPI } from '../../hooks/useDataAPI';
import styles from './SearchForm.module.css';

export default function SearchForm({
  surveyName,
  onSurveyNameChange,
  selectedCollections,
  onCollectionsChange,
  availableCollections,
  dateRange,
  onDateRangeChange,
  surveyNames = [],
  selectedUser = '',
  onUserChange,
  userOptions = [],
  includeMedia = false,
  onIncludeMediaChange,
  fileFormat = 'json',
  onFileFormatChange,
  onClearFilters
}) {
  const [searchQuery, setSearchQuery] = useState(surveyName);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const { searchSurveys } = useDataAPI();
  const suggestionsRef = useRef(null);

  const hasActiveFilters = Boolean(
    (dateRange?.startDate && dateRange.startDate !== '') ||
    (dateRange?.endDate && dateRange.endDate !== '') ||
    (Array.isArray(selectedCollections) && selectedCollections.length > 0) ||
    (selectedUser && selectedUser !== '') ||
    includeMedia === true ||
  (fileFormat && fileFormat !== 'json')
  );

  useEffect(() => {
    setSearchQuery(surveyName || '');
  }, [surveyName]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Search for survey name suggestions
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 3) {
        setIsSearching(true);
        const results = await searchSurveys(searchQuery);
        setSuggestions(results);
        setIsSearching(false);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [searchQuery, searchSurveys]);

  // Handle survey name input change
  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Clear the selected survey if input is emptied
    if (!value.trim()) {
      onSurveyNameChange('');
    }
  };

  // Handle survey suggestion selection
  const handleSuggestionSelect = (survey) => {
    setSearchQuery(survey.name);
    onSurveyNameChange(survey.id, survey.name); // Pass both ID and name
    setShowSuggestions(false);
  };

  const handleDropdownSelect = (e) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (value) {
      const selectedOption = surveyNames.find(option => option.name === value);

      if (selectedOption) {
        onSurveyNameChange(selectedOption.id, selectedOption.name);
      } else {
        onSurveyNameChange('', value);
      }
    } else {
      onSurveyNameChange('');
    }

    setShowSuggestions(false);
  };

  // Handle collection selection
  const handleCollectionChange = (e) => {
    const value = e.target.value;
    if (e.target.checked) {
      onCollectionsChange([...selectedCollections, value]);
    } else {
      onCollectionsChange(selectedCollections.filter(col => col !== value));
    }
  };

  // Handle date range changes
  const handleStartDateChange = (e) => {
    onDateRangeChange({
      ...dateRange,
      startDate: e.target.value
    });
  };

  const handleEndDateChange = (e) => {
    onDateRangeChange({
      ...dateRange,
      endDate: e.target.value
    });
  };

  const handleUserChange = (e) => {
    const value = e.target.value;
    onUserChange?.(value);
  };

  const handleIncludeMediaChange = (e) => {
    const value = e.target.value === 'true';
    onIncludeMediaChange?.(value);
  };

  const handleFileFormatChange = (e) => {
    onFileFormatChange?.(e.target.value);
  };

  return (
    <div className={styles.formContainer}>
      {/* Survey Name Search */}
      <div className={styles.formGroup}>
        <label htmlFor="surveyName" className={styles.label}>Survey Name</label>
        {surveyNames.length > 0 && (
          <select
            className={`${styles.input} ${styles.select}`}
            value={surveyName ? surveyName : ''}
            onChange={handleDropdownSelect}
          >
            <option value="">Select a survey...</option>
            {surveyNames.map(option => (
              <option key={option.id} value={option.name}>
                {option.name}
              </option>
            ))}
          </select>
        )}
        {/* Temporarily disabled text input search
        <div className={styles.inputWrapper} ref={suggestionsRef}>
          <input
            id="surveyName"
            type="text"
            value={searchQuery}
            onChange={handleSearchInputChange}
            placeholder="Start typing to search surveys..."
            className={styles.input}
            autoComplete="off"
          />
          {isSearching && <div className={styles.spinner}></div>}
          
          {showSuggestions && suggestions.length > 0 && (
            <ul className={styles.suggestionsList}>
              {suggestions.map(survey => (
                <li 
                  key={survey.id} 
                  className={styles.suggestionItem}
                  onClick={() => handleSuggestionSelect(survey)}
                >
                  {survey.name}
                </li>
              ))}
            </ul>
          )}
          
          {showSuggestions && searchQuery.length >= 3 && suggestions.length === 0 && (
            <div className={styles.noSuggestions}>
              No surveys found
            </div>
          )}
        </div>
        */}
      </div>

      {/* Collections Selection temporarily disabled
      <div className={styles.formGroup}>
        <label className={styles.label}>Collections</label>
        {availableCollections.length > 0 ? (
          <div className={styles.collectionsContainer}>
            {availableCollections.map(collection => (
              <div key={collection.id} className={styles.checkboxWrapper}>
                <input
                  type="checkbox"
                  id={`collection-${collection.id}`}
                  value={collection.id}
                  checked={selectedCollections.includes(collection.id)}
                  onChange={handleCollectionChange}
                  className={styles.checkbox}
                />
                <label htmlFor={`collection-${collection.id}`} className={styles.checkboxLabel}>
                  {collection.name}
                </label>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyCollections}>
            {surveyName ? 'No collections available for this survey' : 'Select a survey to view collections'}
          </div>
        )}
      </div>
      */}

      {/* Date Range */}
      <div className={styles.formGroup}>
        <label className={styles.label}>Date Range</label>
        <div className={styles.dateRangeContainer}>
          <div className={styles.dateInput}>
            <label htmlFor="startDate" className={styles.dateLabel}>From</label>
            <input
              id="startDate"
              type="date"
              value={dateRange.startDate || ''}
              onChange={handleStartDateChange}
              className={styles.input}
            />
          </div>
          <div className={styles.dateInput}>
            <label htmlFor="endDate" className={styles.dateLabel}>To</label>
            <input
              id="endDate"
              type="date"
              value={dateRange.endDate || ''}
              onChange={handleEndDateChange}
              className={styles.input}
              min={dateRange.startDate || ''}
            />
          </div>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="surveyUser" className={styles.label}>User</label>
        <select
          id="surveyUser"
          className={`${styles.input} ${styles.select} ${styles.userSelect}`}
          value={selectedUser || ''}
          onChange={handleUserChange}
          disabled={!surveyName || userOptions.length === 0}
        >
          <option value="">All users</option>
          {userOptions.map(user => (
            <option key={user} value={user}>
              {user}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formGroup}>
        <span id="includeMediaLabel" className={styles.label}>Media</span>
        <div className={styles.radioGroup} role="radiogroup" aria-labelledby="includeMediaLabel">
          <div className={styles.radioOption}>
            <input
              type="radio"
              id="includeMediaFalse"
              name="includeMedia"
              value="false"
              checked={!includeMedia}
              onChange={handleIncludeMediaChange}
            />
            <label htmlFor="includeMediaFalse" className={styles.radioLabel}>
              Don't include media
            </label>
          </div>
          <div className={styles.radioOption}>
            <input
              type="radio"
              id="includeMediaTrue"
              name="includeMedia"
              value="true"
              checked={includeMedia}
              onChange={handleIncludeMediaChange}
            />
            <label htmlFor="includeMediaTrue" className={styles.radioLabel}>
              Include media files
            </label>
          </div>
        </div>
      </div>

      <div className={styles.formGroup}>
        <span id="fileFormatLabel" className={styles.label}>File Format</span>
        <div className={styles.radioGroup} role="radiogroup" aria-labelledby="fileFormatLabel">
          <div className={styles.radioOption}>
            <input
              type="radio"
              id="formatCsv"
              name="fileFormat"
              value="csv"
              checked={fileFormat === 'csv'}
              onChange={handleFileFormatChange}
            />
            <label htmlFor="formatCsv" className={styles.radioLabel}>CSV</label>
          </div>
          <div className={styles.radioOption}>
            <input
              type="radio"
              id="formatJson"
              name="fileFormat"
              value="json"
              checked={fileFormat === 'json'}
              onChange={handleFileFormatChange}
            />
            <label htmlFor="formatJson" className={styles.radioLabel}>JSON</label>
          </div>
        </div>
      </div>

      <div className={styles.actionsRow}>
        <button
          type="button"
          className={styles.clearButton}
          onClick={onClearFilters}
          disabled={!hasActiveFilters}
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
}