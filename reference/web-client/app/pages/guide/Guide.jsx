import React from "react";
import styles from "./Guide.module.css";

export default function Guide() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>User Guide</h1>
      <p className={styles.subtitle}>
        Learn how to search, filter, and download survey data from the Harvest Data Portal
      </p>

      {/* Searching For Results */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Searching For Results</h2>
        <p>
          Start by selecting a survey name from the dropdown menu. You can type to filter
          the list of available surveys. Once you select a survey, you'll see all completed
          instances of that survey.
        </p>
        <div className={styles.imagePlaceholder}>
          <span className={styles.placeholderText}>📸 Screenshot: Search form with survey selection</span>
        </div>
        <p>
          Use the additional filters to narrow down your results:
        </p>
        <ul className={styles.list}>
          <li><strong>Collections:</strong> Filter by specific data collections associated with the survey</li>
          <li><strong>Date Range:</strong> Select a start and/or end date to filter by completion date</li>
          <li><strong>User:</strong> Filter results by the user who completed the survey</li>
        </ul>
      </section>

      {/* Selecting Results */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Selecting Results</h2>
        <p>
          After searching, you'll see a list of survey results matching your criteria. 
          Each row shows the survey name, number of observations, completion date, and user.
        </p>
        <div className={styles.imagePlaceholder}>
          <span className={styles.placeholderText}>📸 Screenshot: Survey results table with checkboxes</span>
        </div>
        <p>
          Select individual surveys by clicking the checkbox next to each row, or use the
          checkbox in the header to select all results at once. You can sort the results
          by clicking on any column header.
        </p>
      </section>

      {/* Selecting a Data Format */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Selecting a Data Format</h2>
        <p>
          Before downloading, choose your preferred data format:
        </p>
        <ul className={styles.list}>
          <li><strong>JSON:</strong> Structured format ideal for programmatic access and preserving data hierarchy</li>
          <li><strong>CSV:</strong> Tabular format perfect for spreadsheet applications and statistical analysis</li>
        </ul>
        <div className={styles.imagePlaceholder}>
          <span className={styles.placeholderText}>📸 Screenshot: Format selection dropdown</span>
        </div>
        <p>
          You can also choose whether to include media files (images, audio, video) in your export.
          Note that including media will increase the download size and processing time.
        </p>
      </section>

      {/* Downloading Results */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Downloading Results</h2>
        <p>
          Once you've selected your surveys and chosen a format, click the "Download Selected"
          button. The system will process your request and prepare your data for download.
        </p>
        <div className={styles.imagePlaceholder}>
          <span className={styles.placeholderText}>📸 Screenshot: Download button and export status</span>
        </div>
        <p>
          You'll see a progress indicator showing:
        </p>
        <ul className={styles.list}>
          <li>Number of surveys being aggregated</li>
          <li>Total observation count</li>
          <li>Processing status</li>
        </ul>
        <p>
          When processing is complete, a download link will appear. Click it to save your
          data file to your computer.
        </p>
      </section>

      {/* Exploring the Data */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Exploring the Data</h2>
        <p>
          Once downloaded, you can open and explore your data using various tools depending
          on the format you chose.
        </p>
        
        <h3 className={styles.subsectionTitle}>JSON Format</h3>
        <p>
          JSON files contain nested, structured data. Here's an example of what you might see:
        </p>
        <div className={styles.codeBlock}>
          <pre>
            <code>{`{
  "surveys": [
    {
      "id": "survey_123",
      "name": "Field Survey 2024",
      "completedDate": "2024-11-15T10:30:00Z",
      "user": "researcher@example.com",
      "observations": [
        {
          "id": "obs_001",
          "timestamp": "2024-11-15T10:35:22Z",
          "location": {
            "latitude": 38.6270,
            "longitude": -90.1994
          },
          "data": {
            "species": "Oak Tree",
            "height_meters": 12.5,
            "condition": "healthy"
          }
        }
      ]
    }
  ]
}`}</code>
          </pre>
        </div>
        <p>
          JSON files can be opened with:
        </p>
        <ul className={styles.list}>
          <li>Text editors (VS Code, Sublime Text, Notepad++)</li>
          <li>Programming languages (Python, JavaScript, R)</li>
          <li>JSON viewers and formatters</li>
        </ul>

        <h3 className={styles.subsectionTitle}>CSV Format</h3>
        <p>
          CSV files are flat, tabular data. Here's an example:
        </p>
        <div className={styles.codeBlock}>
          <pre>
            <code>{`survey_id,survey_name,completed_date,user,observation_id,timestamp,latitude,longitude,species,height_meters,condition
survey_123,Field Survey 2024,2024-11-15T10:30:00Z,researcher@example.com,obs_001,2024-11-15T10:35:22Z,38.6270,-90.1994,Oak Tree,12.5,healthy
survey_123,Field Survey 2024,2024-11-15T10:30:00Z,researcher@example.com,obs_002,2024-11-15T10:42:15Z,38.6275,-90.1988,Maple Tree,8.3,healthy`}</code>
          </pre>
        </div>
        <p>
          CSV files can be opened with:
        </p>
        <ul className={styles.list}>
          <li>Spreadsheet applications (Microsoft Excel, Google Sheets, LibreOffice Calc)</li>
          <li>Statistical software (R, SPSS, SAS)</li>
          <li>Programming languages with CSV libraries</li>
        </ul>
      </section>

      {/* API Access */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Accessing via API</h2>
        <div className={styles.comingSoon}>
          <span className={styles.comingSoonBadge}>Coming Soon!</span>
          <p>
            Direct API access for programmatic data retrieval will be available soon.
            This will allow you to integrate Harvest data directly into your applications
            and automated workflows.
          </p>
        </div>
        <div className={styles.imagePlaceholder}>
          <span className={styles.placeholderText}>📸 Screenshot: API documentation preview</span>
        </div>
      </section>

      {/* Support */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Need Help?</h2>
        <p>
          If you encounter any issues or have questions about using the Harvest Data Portal,
          please contact your system administrator or refer to the project documentation.
        </p>
      </section>
    </div>
  );
}
