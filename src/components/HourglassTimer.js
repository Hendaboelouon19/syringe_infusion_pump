import React, { useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors } from '../theme/colors';

export default function HourglassTimer({ progress, isRunning }) {
  const formattedTopSand = `${Math.max(0, 100 - progress * 100)}%`;
  const formattedBottomSand = `${Math.min(100, progress * 100)}%`;

  return (
    <Animated.View style={[styles.hourglass, { transform: [{ rotate: '0deg' }] }]}>
      
      {/* Top Glass */}
      <View style={[styles.glassHalf, styles.topHalf]}>
         <View style={styles.sandContainer}>
           <View style={[styles.sand, { height: formattedTopSand, top: 0 }]} />
         </View>
      </View>

      {/* Middle Neck */}
      <View style={styles.neck}>
        {isRunning && progress < 1 && progress > 0 && <View style={styles.fallingSand} />}
      </View>

      {/* Bottom Glass */}
      <View style={[styles.glassHalf, styles.bottomHalf]}>
         <View style={styles.sandContainer}>
           <View style={[styles.sand, { height: formattedBottomSand, bottom: 0 }]} />
         </View>
      </View>
      
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hourglass: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
  },
  glassHalf: {
    width: 120,
    height: 120,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 4,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  topHalf: {
    borderTopLeftRadius: 60,
    borderTopRightRadius: 60,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  bottomHalf: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
  },
  neck: {
    width: 12,
    height: 20,
    backgroundColor: colors.border,
    alignItems: 'center',
  },
  sandContainer: {
    flex: 1,
    position: 'relative',
  },
  sand: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FDEE87', // Butter yellow
  },
  fallingSand: {
    width: 4,
    height: '100%',
    backgroundColor: '#FDEE87', // Butter yellow
  }
});
