const DataAPI = async () => {
    try {
      let data = await fetch(
        "https://sheets.googleapis.com/v4/spreadsheets/1KA2vo2zthyQD_Hb-9eWuXPQOGm1FiiiGHbI_ad8nCJE/values/sheet1?valueRenderOption=FORMATTED_VALUE&key=AIzaSyCkhdyK_akSzF4pcAugtpJODb6XVgdo88A"
      );
      let { values } = await data.json();
      let [, ...Data] = values.map((data) => data);
      return Data;
    } catch {
      console.log("Error");
    }
  };
  export default DataAPI;