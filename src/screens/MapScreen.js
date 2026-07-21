import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Linking,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { getApprovedBusinesses, getAllServiceProviders } from '../data/storage';
import { getCategories } from '../data/services';

export default function MapScreen({ navigation }) {
  const { colors } = useTheme();
  const [providers, setProviders] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  useFocusEffect(
    React.useCallback(() => {
      loadProviders();
    }, [])
  );

  const loadProviders = async () => {
    const cats = await getCategories();
    setCategories(cats);
    const businesses = await getApprovedBusinesses();
    const sp = await getAllServiceProviders();
    setProviders([...businesses, ...sp]);
    setLoading(false);
  };

  const filtered = selectedCategory === 'All'
    ? providers
    : providers.filter((p) => p.category === selectedCategory);

  const usedCategories = [...new Set(providers.map((p) => p.category))];

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.headerBg} />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Ionicons name="map" size={24} color={colors.headerText} />
          <Text style={styles.headerTitle}>Service Map</Text>
        </View>
        <Text style={styles.headerSubtitle}>Nampundwe, Zambia</Text>
      </View>

      <View style={styles.categoryFilter}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['All', ...usedCategories]}
          keyExtractor={(item) => item}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterChip, selectedCategory === item && styles.filterChipActive]}
              onPress={() => setSelectedCategory(item)}
            >
              <Text style={[styles.filterText, selectedCategory === item && styles.filterTextActive]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('ServiceDetail', { service: item })}
          >
            <View style={styles.cardLeft}>
              <View style={[styles.cardIcon, { backgroundColor: categories.find((c) => c.name === item.category)?.color || '#1a237e' }]}>
                <Ionicons name={categories.find((c) => c.name === item.category)?.icon || 'briefcase'} size={20} color="#fff" />
              </View>
            </View>
            <View style={styles.cardCenter}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardCategory}>{item.category}</Text>
              <View style={styles.cardAddress}>
                <Ionicons name="location" size={12} color={colors.textMuted} />
                <Text style={styles.cardAddressText} numberOfLines={1}>{item.address || 'Nampundwe'}</Text>
              </View>
            </View>
            <View style={styles.cardRight}>
              {item.phone && (
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => Linking.openURL(`tel:${item.phone}`)}
                >
                  <Ionicons name="call" size={18} color="#4CAF50" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => {
                  const addr = encodeURIComponent(item.address || 'Nampundwe, Zambia');
                  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${addr}`);
                }}
              >
                <Ionicons name="navigate" size={18} color="#2196F3" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="map-outline" size={48} color="#C4C4C4" />
            <Text style={styles.emptyText}>No providers found</Text>
            <Text style={styles.emptySubtext}>Try a different category</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.headerBg,
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.headerText,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#C5CAE9',
    marginLeft: 34,
  },
  categoryFilter: {
    backgroundColor: colors.card,
    elevation: 1,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.borderLight,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#1a237e',
  },
  filterText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
  },
  cardLeft: {
    marginRight: 12,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardCenter: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  cardCategory: {
    fontSize: 12,
    color: '#1a237e',
    marginBottom: 4,
  },
  cardAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardAddressText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  cardRight: {
    alignItems: 'center',
    gap: 8,
  },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
});
