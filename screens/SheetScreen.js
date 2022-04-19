import React, { useEffect, useState } from "react";
import { View, StyleSheet, Text, ScrollView, ActivityIndicator, Linking, ImageBackground } from "react-native";
import { Card } from "react-native-paper";
import FetchData from "../FetchData";

export default function SheetScreen() {
  const [value, setValue] = useState();
  useEffect(() => {
    let data = async () => {
      setValue(await FetchData());
    };
    data();
  }, []);
  if (!value) {
    return (
      <ActivityIndicator
        size="large"
        animating={true}
        color="rgba(255,172,50,0.85)"
      />
    );
  }
  return (
    <ImageBackground style={{width: '100%', height: '100%'}}
    source={require('../assets/plantField.jpg')}>
    <ScrollView>
      {value.map((data, index) => (
        <Card key={index} style={styles.container}>
          <Card.Content style={styles.content}>
            <Text style={styles.title}>Field Site:</Text>
            <Text style={styles.paragraph}>
              {!data[0] ? "Not Given" : data[0]}
            </Text>
          </Card.Content>
          <Card.Content style={styles.content}>
            <Text style={styles.title}>Task:</Text>
            <Text style={styles.paragraph}>
              {!data[1] ? "Not Provided" : data[1]}
            </Text>
          </Card.Content>
          <Card.Content style={styles.content}>
            <Text style={styles.title}>Form URL:</Text>
            <Text style={styles.paragraph}>
              {!data[2] ? "Not Provided" : <Text style={{color: 'blue'}} onPress={() => Linking.openURL(data[2])}> Form URL </Text>}
            </Text>
          </Card.Content>
          <Card.Content style={styles.content}>
            <Text style={styles.title}>Response URL:</Text>
            <Text style={styles.paragraph}>
              {!data[3] ? "Not Provided" : <Text style={{color: 'blue'}} onPress={() => Linking.openURL(data[3])}> Sheets URL </Text>}
            </Text>
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 10,
    borderWidth: 4,
    borderRadius: 20,
    backgroundColor: "rgba(255,172,50,0.85)",
    borderColor: "rgba(255,172,50,0.85)",
  },
  content: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 10,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginRight: 5,
  },
  paragraph: {
    fontSize: 18,
  },
});