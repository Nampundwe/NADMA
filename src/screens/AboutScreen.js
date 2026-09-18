import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Linking,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { createStyleSheet } from '../utils/responsive';

export default function AboutScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.headerBg} />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="business" size={36} color={colors.headerText} />
          </View>
          <Text style={styles.headerTitle}>Nadma</Text>
          <Text style={styles.headerVersion}>Version 1.0.0</Text>
        </View>

        <View style={styles.content}>
          {/* Mission Cards */}
          <View style={styles.card}>
            <View style={[styles.cardIcon, { backgroundColor: colors.infoLight }]}>
              <Ionicons name="people" size={28} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Our Mission</Text>
            <Text style={styles.cardText}>
              Nadma connects the people of Nampundwe with reliable
              local service providers. We believe everyone deserves
              access to quality services in their community.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={[styles.cardIcon, { backgroundColor: colors.successLight }]}>
              <Ionicons name="shield-checkmark" size={28} color={colors.success} />
            </View>
            <Text style={styles.cardTitle}>Verified Providers</Text>
            <Text style={styles.cardText}>
              All service providers on Nadma are verified and
              reviewed by our community. Your satisfaction is our priority.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={[styles.cardIcon, { backgroundColor: colors.dangerLight }]}>
              <Ionicons name="heart" size={28} color={colors.danger} />
            </View>
            <Text style={styles.cardTitle}>Community First</Text>
            <Text style={styles.cardText}>
              Proudly serving the Nampundwe community. Our goal
              is to support local businesses and help them grow.
            </Text>
          </View>

          {/* Features */}
          <View style={styles.featuresCard}>
            <Text style={styles.featuresTitle}>What We Offer</Text>
            <View style={styles.featureRow}>
              <View style={[styles.featureDot, { backgroundColor: colors.info }]} />
              <Text style={styles.featureText}>Browse local service providers</Text>
            </View>
            <View style={styles.featureRow}>
              <View style={[styles.featureDot, { backgroundColor: colors.success }]} />
              <Text style={styles.featureText}>Book services directly</Text>
            </View>
            <View style={styles.featureRow}>
              <View style={[styles.featureDot, { backgroundColor: colors.warning }]} />
              <Text style={styles.featureText}>Read and write reviews</Text>
            </View>
            <View style={styles.featureRow}>
              <View style={[styles.featureDot, { backgroundColor: colors.danger }]} />
              <Text style={styles.featureText}>Message providers instantly</Text>
            </View>
            <View style={styles.featureRow}>
              <View style={[styles.featureDot, { backgroundColor: colors.purple }]} />
              <Text style={styles.featureText}>Get real-time notifications</Text>
            </View>
          </View>

          {/* Contact */}
          <View style={styles.contactCard}>
            <Text style={styles.contactTitle}>Get in Touch</Text>

            <TouchableOpacity
              style={styles.contactItem}
              activeOpacity={0.7}
              onPress={() => Linking.openURL('mailto:munangimuyambangorodwell@gmail.com')}
            >
              <View style={[styles.contactIcon, { backgroundColor: colors.infoLight }]}>
                <Ionicons name="mail" size={20} color={colors.info} />
              </View>
              <View>
                <Text style={styles.contactLabel}>Email</Text>
                <Text style={styles.contactValue}>munangimuyambangorodwell@gmail.com</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactItem}
              activeOpacity={0.7}
              onPress={() => Linking.openURL('tel:0572053023')}
            >
              <View style={[styles.contactIcon, { backgroundColor: colors.successLight }]}>
                <Ionicons name="phone" size={20} color={colors.success} />
              </View>
              <View>
                <Text style={styles.contactLabel}>Phone</Text>
                <Text style={styles.contactValue}>057 205 3023</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactItem}
              activeOpacity={0.7}
              onPress={() => Linking.openURL('tel:0978195999')}
            >
              <View style={[styles.contactIcon, { backgroundColor: colors.successLight }]}>
                <Ionicons name="phone" size={20} color={colors.success} />
              </View>
              <View>
                <Text style={styles.contactLabel}>Phone</Text>
                <Text style={styles.contactValue}>097 819 5999</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactItem}
              activeOpacity={0.7}
              onPress={() => Linking.openURL('tel:0971407244')}
            >
              <View style={[styles.contactIcon, { backgroundColor: colors.successLight }]}>
                <Ionicons name="phone" size={20} color={colors.success} />
              </View>
              <View>
                <Text style={styles.contactLabel}>Phone</Text>
                <Text style={styles.contactValue}>097 140 7244</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.contactItem}>
              <View style={[styles.contactIcon, { backgroundColor: colors.warningLight }]}>
                <Ionicons name="location-on" size={20} color={colors.warning} />
              </View>
              <View>
                <Text style={styles.contactLabel}>Location</Text>
                <Text style={styles.contactValue}>Nampundwe, Zambia</Text>
              </View>
            </View>
          </View>

          <Text style={styles.footer}>Made with love for Nampundwe</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors) => createStyleSheet({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    backgroundColor: colors.headerBg,
    padding: 28,
    paddingBottom: 36,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.headerText,
    marginBottom: 4,
  },
  headerVersion: {
    fontSize: 13,
    color: colors.textMuted,
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  featuresCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  featuresTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  featureText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  contactCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  contactTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 14,
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  footer: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 8,
    marginBottom: 30,
  },
});
