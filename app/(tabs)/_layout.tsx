import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function Icon({ label }: { label: string }) {
  const icons: Record<string, string> = {
    home: '🏠', forms: '📝', submissions: '📋', drafts: '📂', sync: '🔄', profile: '👤',
  };
  return <Text style={{ fontSize: 20 }}>{icons[label] ?? '•'}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#15803d' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: '#16a34a',
        tabBarInactiveTintColor: '#9ca3af',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Dashboard', tabBarIcon: () => <Icon label="home" />, tabBarLabel: 'Home' }}
      />
      <Tabs.Screen
        name="forms"
        options={{ title: 'Forms', tabBarIcon: () => <Icon label="forms" />, tabBarLabel: 'Forms' }}
      />
      <Tabs.Screen
        name="submissions"
        options={{ title: 'Submissions', tabBarIcon: () => <Icon label="submissions" />, tabBarLabel: 'History' }}
      />
      <Tabs.Screen
        name="drafts"
        options={{ title: 'Drafts', tabBarIcon: () => <Icon label="drafts" />, tabBarLabel: 'Drafts' }}
      />
      <Tabs.Screen
        name="sync"
        options={{ title: 'Sync', tabBarIcon: () => <Icon label="sync" />, tabBarLabel: 'Sync' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: () => <Icon label="profile" />, tabBarLabel: 'Profile' }}
      />
    </Tabs>
  );
}
