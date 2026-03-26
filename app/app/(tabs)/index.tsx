import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

export default function Home() {
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center bg-blue-50">
      <Text className="text-3xl font-bold mb-10">
        Flood Safety Dashboard
      </Text>

      <TouchableOpacity
        className="bg-red-500 p-5 rounded-xl w-60 mb-6"
        onPress={() => router.push("/report")}
      >
        <Text className="text-white text-center text-lg font-semibold">
          Report Flood
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="bg-blue-500 p-5 rounded-xl w-60"
        onPress={() => router.push("/map")}
      >
        <Text className="text-white text-center text-lg font-semibold">
          View Safe Route Map
        </Text>
      </TouchableOpacity>
    </View>
  );
}