import React, { useContext } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFileContext } from '../contexts/FileContext';
import { useSurveyDesign } from '../contexts/SurveyDesignContext'
import styles from '../Styles';

const SurveyList = ({ navigation }) => {
  const { surveyFiles, convertXLSXToSurvey } = useFileContext(); // Access surveyFiles from FileContext

  const { clearSurveyDesign, setSurveyDesign } = useSurveyDesign()

  const handleLoadSurvey = (filePath) => {
    
    clearSurveyDesign();

    convertXLSXToSurvey(filePath, setSurveyDesign);


    navigation.navigate('CollectionList');
  };

  return (
    <View style={styles.container}>
      {surveyFiles.length === 0 ? (
        <Text>No Surveys Found</Text>
      ) : (
        surveyFiles.map((filePath, index) => {
          // Extract file name without extension
          let surveyName = filePath.substring(filePath.lastIndexOf('/') + 1).replace('.xlsx', '');
          surveyName = surveyName.replace(/_/g, ' ');
  
          return (
            <TouchableOpacity
              key={index}
              style={styles.button}
              onPress={() => handleLoadSurvey(filePath)}
            >
              <Text style={styles.text}>{surveyName}</Text>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
};

export default SurveyList;