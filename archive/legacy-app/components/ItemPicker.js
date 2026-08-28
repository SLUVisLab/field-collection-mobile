import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet, 
  Modal, 
  SafeAreaView 
} from 'react-native';
import { useSurveyDesign } from '../contexts/SurveyDesignContext';
import { useSurveyData } from '../contexts/SurveyDataContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import styles from '../Styles';

const ItemPicker = ({ 
  visible, 
  onClose, 
  onSelect, 
  sourceItem = null,
  targetCanHaveExistingData = true 
}) => {
  const { surveyDesign, findCollectionByID } = useSurveyDesign();
  const { itemHasObservation } = useSurveyData();
  
  const [currentCollectionID, setCurrentCollectionID] = useState(null);
  const [navigationStack, setNavigationStack] = useState([]);

  // Find the current collection
  const currentCollection = currentCollectionID ? findCollectionByID(currentCollectionID) : null;

  // Reset to root when modal opens
  React.useEffect(() => {
    if (visible) {
      setCurrentCollectionID(null);
      setNavigationStack([]);
    }
  }, [visible]);

  const navigateToCollection = (collectionID, collectionName) => {
    setNavigationStack(prev => [...prev, { id: currentCollectionID, name: currentCollection?.name || 'Collections' }]);
    setCurrentCollectionID(collectionID);
  };

  const navigateBack = () => {
    if (navigationStack.length > 0) {
      const previous = navigationStack[navigationStack.length - 1];
      setNavigationStack(prev => prev.slice(0, -1));
      setCurrentCollectionID(previous.id);
    }
  };

  const handleItemSelect = (item, collection) => {
    // Check if this is the source item
    if (sourceItem && item.ID === sourceItem.ID) {
      return; // Don't allow selecting the same item
    }

    // Check if target can have existing data
    const hasExistingData = itemHasObservation(item.ID);
    if (!targetCanHaveExistingData && hasExistingData) {
      return; // Don't allow selecting items with existing data
    }

    onSelect(item, collection);
  };

  const isItemSelectable = (item) => {
    // Don't allow selecting the source item
    if (sourceItem && item.ID === sourceItem.ID) {
      return false;
    }

    // Check if target can have existing data
    const hasExistingData = itemHasObservation(item.ID);
    if (!targetCanHaveExistingData && hasExistingData) {
      return false;
    }

    return true;
  };

  const getItemStyle = (item) => {
    const hasExistingData = itemHasObservation(item.ID);
    const isSelectable = isItemSelectable(item);
    const isSourceItem = sourceItem && item.ID === sourceItem.ID;

    return [
      styles.surveyItemButton,
      localStyles.pickerItem,
      {
        borderColor: hasExistingData ? 'green' : 'transparent',
        borderWidth: 1.5,
        opacity: isSelectable ? 1 : 0.5,
        backgroundColor: isSourceItem ? '#f0f0f0' : 'white'
      }
    ];
  };

  const renderHeader = () => {
    const title = currentCollection ? currentCollection.name : 'Select Target Item';
    const showBackButton = navigationStack.length > 0;

    return (
      <View style={localStyles.header}>
        <View style={localStyles.headerLeft}>
          {showBackButton && (
            <TouchableOpacity onPress={navigateBack} style={localStyles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#007AFF" />
            </TouchableOpacity>
          )}
          <Text style={localStyles.headerTitle}>{title}</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={localStyles.closeButton}>
          <Ionicons name="close" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderContent = () => {
    // Root level - show all collections
    if (!currentCollectionID) {
      return (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {surveyDesign.collections.map((collection) => (
            <TouchableOpacity
              key={collection.ID}
              onPress={() => navigateToCollection(collection.ID, collection.name)}
              style={[styles.surveyCollectionButton, localStyles.pickerCollection]}
            >
              <Text>{collection.name}</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      );
    }

    // Collection level
    if (currentCollection) {
      // Collection has items
      if (currentCollection.items.length) {
        return (
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            {currentCollection.items.map((item) => (
              <TouchableOpacity
                key={item.ID}
                style={getItemStyle(item)}
                onPress={() => isItemSelectable(item) && handleItemSelect(item, currentCollection)}
                disabled={!isItemSelectable(item)}
              >
                <View style={localStyles.itemContent}>
                  <Text style={[
                    localStyles.itemText,
                    !isItemSelectable(item) && localStyles.disabledText
                  ]}>
                    {item.name}
                  </Text>
                  {sourceItem && item.ID === sourceItem.ID && (
                    <Text style={localStyles.sourceLabel}>Source</Text>
                  )}
                  {itemHasObservation(item.ID) && (
                    <Ionicons name="checkmark-circle" size={20} color="green" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        );
      }

      // Collection has subcollections
      if (currentCollection.subCollections.length) {
        return (
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            {currentCollection.subCollections.map((subcollection) => (
              <TouchableOpacity
                key={subcollection.ID}
                style={[styles.surveyCollectionButton, localStyles.pickerCollection]}
                onPress={() => navigateToCollection(subcollection.ID, subcollection.name)}
              >
                <Text>{subcollection.name}</Text>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        );
      }
    }

    return (
      <View style={localStyles.emptyState}>
        <Text>No items available in this collection.</Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={localStyles.container}>
        {renderHeader()}
        <View style={localStyles.content}>
          {renderContent()}
        </View>
        
        {/* Info footer */}
        <View style={localStyles.footer}>
          <View style={localStyles.legendItem}>
            <Ionicons name="checkmark-circle" size={16} color="green" />
            <Text style={localStyles.legendText}>Has data</Text>
          </View>
          {!targetCanHaveExistingData && (
            <Text style={localStyles.footerNote}>
              Items with existing data cannot be selected
            </Text>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 8,
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  pickerCollection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerItem: {
    marginVertical: 4,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  disabledText: {
    color: '#999',
  },
  sourceLabel: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginRight: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  footer: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  footerNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
});

export default ItemPicker;
