import { Tabs } from 'expo-router';
import React from 'react';

import { HomeIcon } from '@/components/ui/home-icon';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThotLogoIcon } from '@/components/ui/thot-logo-icon';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.tabBarBackground,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 70,
        },
        tabBarIconStyle: {
          width: 36,
          height: 36,
        },
        tabBarActiveTintColor: Colors.tabBarActive,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarShowLabel: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <HomeIcon size={32} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="thot"
        options={{
          title: 'Thot',
          tabBarIcon: ({ color }) => (
            <ThotLogoIcon size={32} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={32} name="person.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
