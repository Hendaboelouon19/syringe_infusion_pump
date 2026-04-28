import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, TouchableOpacity, Modal } from 'react-native';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');
const ITEM_WIDTH = width * 0.68;
const SPACING = (width - ITEM_WIDTH) / 2;

const CAROUSEL_DATA = [
  { id: '1', title: 'Infusion Config', desc: 'Set drug dose and calculate optimal motor flow rate automatically.', icon: 'water', screen: 'Control', iconBg: colors.primary },
  { id: '2', title: 'Countdown', desc: 'Auto-calculating descending hourglass synced directly to motor flow.', icon: 'hourglass', screen: 'Timer', iconBg: colors.accent },
  { id: '3', title: 'Alarms', desc: 'Monitor hardware events like empty syringe detection and controller status.', icon: 'warning', screen: 'Alarms', iconBg: colors.danger },
  { id: '4', title: 'Manual Override', desc: 'Directly control motor speed, forward, and reverse directions.', icon: 'game-controller', screen: 'Manual', iconBg: colors.success ?? '#27ae60' },
];

export default function HomeScreen({ navigation }) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const [menuVisible, setMenuVisible] = useState(false);

  const renderBackgroundStars = () => (
    <View style={StyleSheet.absoluteFillObject}>
      <View style={[styles.star, { top: '10%', left: '20%', backgroundColor: colors.accent, width: 8, height: 8 }]} />
      <View style={[styles.star, { top: '30%', left: '80%', backgroundColor: colors.success, width: 6, height: 6 }]} />
      <View style={[styles.star, { top: '50%', left: '10%', backgroundColor: colors.danger, width: 12, height: 12 }]} />
      <View style={[styles.star, { top: '80%', left: '70%', backgroundColor: '#ffffff', width: 5, height: 5 }]} />
      <View style={[styles.star, { top: '70%', left: '30%', backgroundColor: colors.primary, width: 10, height: 10 }]} />
    </View>
  );

  const navigateAndClose = (screen) => {
    setMenuVisible(false);
    navigation.navigate(screen);
  };

  return (
    <View style={styles.container}>
      {renderBackgroundStars()}

      {/* Side Menu Modal */}
      <Modal visible={menuVisible} transparent={true} animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.sidebar}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setMenuVisible(false)}>
              <Ionicons name="close" size={32} color={colors.white} />
            </TouchableOpacity>
            
            <Text style={styles.menuTitle}>Navigation</Text>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => setMenuVisible(false)}>
              <Ionicons name="home" size={24} color={colors.white} style={styles.menuIcon} />
              <Text style={styles.menuText}>Home Hub</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('Control')}>
              <Ionicons name="water" size={24} color={colors.white} style={styles.menuIcon} />
              <Text style={styles.menuText}>Infusion Config</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('Timer')}>
              <Ionicons name="hourglass" size={24} color={colors.white} style={styles.menuIcon} />
              <Text style={styles.menuText}>Smart Timer</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('Alarms')}>
              <Ionicons name="warning" size={24} color={colors.white} style={styles.menuIcon} />
              <Text style={styles.menuText}>System Alarms</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('Manual')}>
              <Ionicons name="game-controller" size={24} color={colors.white} style={styles.menuIcon} />
              <Text style={styles.menuText}>Manual Control</Text>
            </TouchableOpacity>

            <View style={{flex: 1}} />
            <TouchableOpacity style={[styles.menuItem, {borderTopWidth: 1, borderTopColor: colors.primary}]} onPress={() => navigateAndClose('Login')}>
              <Ionicons name="log-out" size={24} color={colors.accent} style={styles.menuIcon} />
              <Text style={[styles.menuText, {color: colors.accent}]}>End Session</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setMenuVisible(false)} />
        </View>
      </Modal>

      {/* Header aligned like reference */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => setMenuVisible(true)}>
          <Ionicons name="menu-outline" size={36} color={colors.white} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.profileAvatar} onPress={() => navigation.navigate('Login')}>
           <Ionicons name="person" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.titleContainer}>
        <Text style={styles.mainTitle}>Syringe</Text>
        <Text style={styles.mainTitle}>Controller</Text>
      </View>

      <Animated.FlatList
        data={CAROUSEL_DATA}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_WIDTH}
        decelerationRate="fast"
        bounces={false}
        contentContainerStyle={{ paddingHorizontal: SPACING, paddingVertical: 40, alignItems: 'center' }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true }
        )}
        renderItem={({ item, index }) => {
          const inputRange = [(index - 1) * ITEM_WIDTH, index * ITEM_WIDTH, (index + 1) * ITEM_WIDTH];
          const scale = scrollX.interpolate({ inputRange, outputRange: [0.8, 1, 0.8], extrapolate: 'clamp' });
          const translateY = scrollX.interpolate({ inputRange, outputRange: [30, 0, 30], extrapolate: 'clamp' });
          const opacity = scrollX.interpolate({ inputRange, outputRange: [0.6, 1, 0.6], extrapolate: 'clamp' });

          return (
            <View style={{ width: ITEM_WIDTH, alignItems: 'center' }}>
               <Animated.View style={[styles.cardContainer, { transform: [{ scale }, { translateY }], opacity }]}>
                  <View style={styles.floatingObjectContainer}>
                    <View style={[styles.floatingObject, { backgroundColor: item.iconBg }]}>
                       <Ionicons name={item.icon} size={64} color={colors.white} />
                    </View>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardDesc}>{item.desc}</Text>
                  </View>
                  <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate(item.screen)} activeOpacity={0.8}>
                     <Ionicons name="arrow-forward" size={24} color={colors.white} />
                  </TouchableOpacity>
               </Animated.View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  star: { position: 'absolute', borderRadius: 50, opacity: 0.8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 30, paddingTop: 60 },
  profileAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center' },
  titleContainer: { paddingHorizontal: 30, marginTop: 20, marginBottom: 0 },
  mainTitle: { fontSize: 38, fontWeight: '900', color: colors.white, letterSpacing: 1 },
  cardContainer: { width: ITEM_WIDTH * 0.9, height: height * 0.5, backgroundColor: colors.white, borderRadius: 40, alignItems: 'center', position: 'relative', shadowColor: '#000', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10, marginTop: 50 },
  floatingObjectContainer: { position: 'absolute', top: -60, width: 140, height: 140, zIndex: 10 },
  floatingObject: { width: '100%', height: '100%', borderRadius: 70, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 15 },
  cardBody: { flex: 1, marginTop: 100, paddingHorizontal: 20, alignItems: 'center' },
  cardTitle: { fontSize: 24, fontWeight: '900', color: colors.textPrimary, marginBottom: 10 },
  cardDesc: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  actionButton: { position: 'absolute', bottom: -25, width: 54, height: 54, borderRadius: 27, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center', shadowColor: colors.accent, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },

  // Modal Sidebar Styles
  modalBg: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)' },
  sidebar: { width: '70%', height: '100%', backgroundColor: colors.background, padding: 30, paddingTop: 60, elevation: 20 },
  modalOverlay: { flex: 1 },
  closeBtn: { alignSelf: 'flex-end', marginBottom: 20 },
  menuTitle: { fontSize: 28, fontWeight: 'bold', color: colors.accent, marginBottom: 40, letterSpacing: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  menuIcon: { marginRight: 15 },
  menuText: { fontSize: 18, color: colors.white, fontWeight: '600' }
});
