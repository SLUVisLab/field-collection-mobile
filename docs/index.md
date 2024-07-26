<div align="center">
  <img src="assets/li_kernza_banner.jpg" alt="Banner" style="width: 100%;">
</div>

# User Guide
(coming soon...)

## Table of Contents
1. [Overview](#overview)
2. [Installation and Setup](#installation-and-setup)
    - [Android](#android)
    - [iOS](#ios)
    - [Registration and Login](#registration-and-login)
3. [Designing A New Survey](#designing-a-new-survey)
    - [Organizing Items in a Survey](#organizing-items-in-a-survey)
    - [Adding Data Collection Tasks to the Survey](#adding-data-collection-tasks-to-the-survey)
    - [Creating Surveys with Spreadsheets](#creating-surveys-with-spreadsheets)
5. [Collecting Data](#collecting-data)
    - [The Collections and Items List](#the-collections-and-items-list)
    - [The Survey Summary](#the-survey-summary)
    - [Saving a Survey](#saving-a-survey)
    - [Leaving a Survey Before You're Finished](#leaving-a-survey-before-youre-finished)
6. [Uploading Data](#uploading-data)
7. [Downloading Data](#downloading-data)
8. [Bug Reporting and Suggesting Improvements](#bug-reporting-and-suggesting-improvements)
9. [Contact](#contact)

## Overview
**NOTE:** The app is currently in its first beta release and full of bugs and opportunities for improvements. Please see the section on reporting bugs or suggesting improvements for more information on contributing.

The data collection app is designed to help collect and organize various types of data by leveraging the capabilities of mobile devices. The app is intended to work **offline-first**, with various organizational layouts of items being observed and recorded, and to **store data in a central cloud database**.

### Key Terms

- **Item:** The individual unit of study. This can represent a singular object or a grouping of objects depending on use-case.
- **Collection/Subcollection:** Items can be grouped into collections. Collections can also contain nested collections up to 1 level deep which are referred to as subcollections. Valid setups would include `collection/[item, item, item]` or `collection/subcollection1/[item, item, item]`.
- **Task:** A data collection action to be performed on items. One item can be associated with several tasks. For example, taking a photo and then recording text input (two tasks) could all be associated with one item.
- **Survey:** The overall set of items and tasks that define data collection and recording activities. Collections can be used to organize items into useful groups. The set of tasks defined in the survey will be performed once for each item defined in the survey.
- **Observation:** The recorded results of data collection activities in a survey. Each item in a survey will have one observation. Each observation will include the recorded data from the set of defined tasks.

## Installation and Setup
### Android
Scan the QR Code below and follow the provided instructions. On Android 8.0 and higher, you may need to navigate to the 'Install unkown apps' system settings screen to enable app installations from a particular location (i.e. your web browser)

#### Download Android
<div style="margin: 20px 0;">
  <img src="assets/android_download.png" alt="iOS Register" style="width: 20%;">
</div>

### iOS
Apple requires that iOS devices are registered using their IMEI code before installing software from outside the app store. To register your device:

1. Scan the QR code below and follow the provided instructions.
2. Contact the app developer and let them know you have registered a new device.
3. If you have not done so already, enable developer mode on your device. [Learn how to enable developer mode](https://docs.expo.dev/guides/ios-developer-mode/).

#### Register iOS
<div style="margin: 20px 0;">
  <img src="assets/ios_register.png" alt="iOS Register" style="width: 20%;">
</div>

#### Download iOS
Once the above steps are complete and the app developer has included your device's IMEI number, you can download and install the app by scanning this QR Code:

<div style="margin: 20px 0;">
  <img src="assets/ios_download.png" alt="iOS Download" style="width: 20%;">
</div>

### Registration and Login
Email and password based login is required to use the app. When first using the app, click the 'register' button to register a new account. You should automatically be logged in upon successful registration. 

Some features like password resetting and account recovery are not implemented yet. Contact app developer for account support.

## Designing A New Survey

The app supports creating and editing surveys using the **in-app GUI** as well as using **excel spreasheets in .xlsx format**. Spreadsheets can be uploaded to the app and will be processed into surveys. See [Creating Surveys with Spreadsheets](#creating-surveys-with-spreadsheets) for more details.

Select 'Manage Surveys' from the home screen followed by 'New Survey' and enter a unique name for the survey. Afterwards, the app will navigate to the **Survey Builder** view.

The Survey Builder is used to organize the structure your survey and specify the data collection tasks involved. **Make sure to save your survey design when finished by clicking 'Save'!**

Once the survey is saved, it will be synced to the cloud and other users will be able to use and interact with it.

<div style="margin: 20px 0;">
  <img src="assets/survey_builder_empty.png" alt="Empty Survey Builder" style="width: 20%;">
</div>

### Organizing Items in a Survey

Surveys are structured using Items, Collections, and Subcollections. 

**Items** are the real-world objects, events, or subjects you want to gather information on. Each item in your survey represents a specific thing you are interested in recording data about.

**Collections** are groupings of items, allowing you to organize related data points. Collections can also contain **Subcollections**, nested up to one level deep. This structure lets your surveys reflect various real-world layouts such as grids, heirarchies, and clusters.

#### Add a new collection
Click 'Collections' from the Survey Builder view and select 'Add Collection'. Give the new collection a unique name and press 'Done'.

<div style="margin: 20px 0;">
  <img src="assets/create_new_collection.png" alt="New Collection" style="width: 20%;">
</div>

Inside an empty collection you have the option to start adding Items or to create a Subcollection.

<div style="margin: 20px 0;">
  <img src="assets/create_item_or_subcollection.png" alt="Subcollections and Items" style="width: 20%;">
</div>

#### Add Items to a Collection

<div style="margin: 20px 0;">
  <img src="assets/new_items_added.png" alt="New Items" style="width: 20%;">
</div>

Select 'Add Item' and give the new item a unique name. for some use cases it can be useful to include a sequence of some sort in the name for organization (ie. Item 1, Item 2, Item 3).
Click 'Done' and your new Item should be visible in the collection.


#### Delete Items or Collections

<div style="margin: 20px 0;">
  <img src="assets/delete_items.png" alt="Delete Items or collections" style="width: 20%;">
</div>

To delete items or collections, enter 'edit mode' by pressing and holding the desired Collection or Item button. Once in edit mode, press the corresponding delete buttons on the items you wish to remove. To exit 'edit mode,' simply press and hold again.


### Adding Data Collection Tasks to the Survey
A **Task** is an action performed to collect data on Items. Each Item can have multiple tasks. For example, a survey might require a user to take a photo of an item (task 1) and then write down a label for that image (task 2).

From the Survey Builder view, select 'New Task' to see a list of the available task types

<div style="margin: 20px 0;">
  <img src="assets/choose_task_type.png" alt="Tasks" style="width: 20%;">
</div>

#### Required Task Fields

<div style="margin: 20px 0;">
  <img src="assets/new_task_fields.png" alt="Tasks" style="width: 20%;">
</div>

Every task requires the following three basic fields: Display Name, Data Label, and Instructions. Additional fields may be needed for specific task types, which are detailed in their respective documentation.

**Display Name:** The visible name of the task. Aim for concise, descriptive names. This will be shown to the user performing the survey.
**Data Label:** The field name used in the JSON key/value pair when the data is collected. This key can be used when downloading and working with your data.
**Instructions:** Directions for the user completing the task.

#### Deleting Tasks

<div style="margin: 20px 0;">
  <img src="assets/delete_tasks.png" alt="Delete Tasks" style="width: 20%;">
</div>

To delete Tasks, enter 'edit mode' by pressing and holding the desired Task button. Once in edit mode, press the corresponding delete buttons on the Taks you wish to remove. To exit 'edit mode,' simply press and hold again.

### Creating Surveys with Spreadsheets
![Creating Surveys with Spreadsheets](assets/creating_surveys_with_spreadsheets.jpg)

[Sample Survey Spreadsheet](https://docs.google.com/spreadsheets/d/1US6NnQ0d1DGMfthzxKN5v8mVlgnrY3Fn/edit?usp=sharing&ouid=104744292422451722330&rtpof=true&sd=true)


## Collecting Data
### The Collections and Items List
![The Collections and Items List](assets/collections_items_list.jpg)

### The Survey Summary
![The Survey Summary](assets/survey_summary.jpg)

### Saving a Survey
![Saving a Survey](assets/saving_a_survey.jpg)

### Leaving a Survey Before You're Finished
![Leaving a Survey Before You're Finished](assets/leaving_a_survey.jpg)

## Uploading Data
![Uploading Data](assets/uploading_data.jpg)

## Downloading Data
![Downloading Data](assets/downloading_data.jpg)

Data download notebook example:

[Data download notebook example](https://colab.research.google.com/drive/1nqj_B1Fb1Wj9i3odYwqdXSxjvPSlokX7#scrollTo=neyS3pR0fhc8)

```python
import requests
import json

CLIENT_APP_ID = "data-pwljoor"
DATABASE_NAME = "SurveyResults"
COLLECTION_NAME = "SurveyResults"
API_KEY = <YOUR_KEY_HERE>

filter_by_survey_name =  {
  "name": "Sample Survey"
}

payload_dict = {
  "database": DATABASE_NAME,
  "collection": COLLECTION_NAME,
  "dataSource": "AtlasCluster",
  "filter": filter_by_survey_name,  # Insert the chosen filter or example from above
  "limit": 10
}

# serialize
payload = json.dumps(payload_dict)

headers = {
  'Access-Control-Request-Headers': '*',
  'apiKey': API_KEY,
  "Content-Type": "application/json",
  "Accept": "application/json"
}

try:
    response = requests.post(url, headers=headers, data=payload)

    if response.status_code != 200:
      raise Exception(f"Error: {response.text}")

    data = response.json()
    
except Exception as e:
    print(e)



```

## Bug Reporting and Suggesting Improvements
If you encounter a bug or have a suggestion for an improvement, please share it! You can...

1. [Create a new issue in the Github repository](https://github.com/SLUVisLab/field-collection-mobile/issues). (Recommended)
2. Contact the app developer directly

<div align="center" style="margin: 20px 0;">
  <img src="assets/issues.png" alt="issue tracker" style="width: 70%;">
</div>

## Contact

Contact Austin Carnahan on NRR-BII Slack or at austin.carnahan@slu.edu with questions or suggestions!
