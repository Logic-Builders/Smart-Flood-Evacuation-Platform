import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Platform } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: "#1E3A8A",
        },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: {
          fontWeight: "700",
          fontSize: 18,
        },

        tabBarActiveTintColor: "#1E3A8A",
        tabBarInactiveTintColor: "#9CA3AF",

        tabBarHideOnKeyboard: false, 

        tabBarStyle: {
          height: 65,
          backgroundColor: "#FFFFFF",
          borderTopWidth: 0,

          // lock it visually
          position: "relative",

          elevation: 10,
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowOffset: { width: 0, height: -2 },
          shadowRadius: 6,
        },

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginBottom: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <View
              style={{
                backgroundColor: focused ? "#DBEAFE" : "transparent",
                padding: 6,
                borderRadius: 10,
              }}
            >
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={size}
                color={color}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size, focused }) => (
            <View
              style={{
                backgroundColor: focused ? "#DBEAFE" : "transparent",
                padding: 6,
                borderRadius: 10,
              }}
            >
              <Ionicons
                name={focused ? "map" : "map-outline"}
                size={size}
                color={color}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="report"
        options={{
          title: "Report",
          tabBarIcon: ({ color, size, focused }) => (
            <View
              style={{
                backgroundColor: focused ? "#DBEAFE" : "transparent",
                padding: 6,
                borderRadius: 10,
              }}
            >
              <Ionicons
                name={focused ? "document-text" : "document-text-outline"}
                size={size}
                color={color}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}