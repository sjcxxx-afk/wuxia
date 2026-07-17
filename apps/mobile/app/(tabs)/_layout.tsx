import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#4F46E5",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: "#F3F4F6",
          paddingBottom: insets.bottom > 0 ? insets.bottom : 6,
          paddingTop: 6,
          height: 56 + insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="items"
        options={{
          title: "匣中",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="file-tray-full-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: "分类",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "搜索",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "匣主",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="diamond-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}