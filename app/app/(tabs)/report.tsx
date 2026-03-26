import { View, Text, TextInput, TouchableOpacity, Image, Modal, Pressable, Animated } from "react-native";
import { useState, useRef, useEffect } from "react";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";

export default function Report() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert("Permission required to access photos");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const submitReport = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    alert("Report Submitted Successfully");
    setName("");
    setPhone("");
    setArea("");
    setImage(null);
  };

  return (
    <LinearGradient
      colors={["#0f172a", "#1e3a8a", "#38bdf8"]}
      className="flex-1"
    >
      <Animated.View
        style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}
        className="flex-1 p-6"
      >
        {/* Glass Card Container */}
        <View className="bg-white/90 backdrop-blur-lg rounded-3xl p-6 shadow-2xl">

          <Text className="text-3xl font-bold mb-6 text-center text-blue-900">
            Flood Report
          </Text>

          <TextInput
            placeholder="Name"
            placeholderTextColor="#6b7280"
            className="border border-gray-200 p-4 rounded-xl mb-4 bg-white"
            value={name}
            onChangeText={setName}
          />

          <TextInput
            placeholder="Phone Number"
            placeholderTextColor="#6b7280"
            className="border border-gray-200 p-4 rounded-xl mb-4 bg-white"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <TextInput
            placeholder="Affected Area"
            placeholderTextColor="#6b7280"
            className="border border-gray-200 p-4 rounded-xl mb-4 bg-white"
            value={area}
            onChangeText={setArea}
          />

          <TouchableOpacity
            className="bg-blue-600 p-4 rounded-xl mb-4 shadow-md active:opacity-80"
            onPress={pickImage}
          >
            <Text className="text-white text-center font-semibold">
              Upload Photo
            </Text>
          </TouchableOpacity>

          {image && (
            <TouchableOpacity
              onPress={() => setModalVisible(true)}
              activeOpacity={0.9}
            >
              <Animated.Image
                source={{ uri: image }}
                style={{
                  width: "100%",
                  height: 180,
                  borderRadius: 16,
                  marginBottom: 16,
                  transform: [{ scale: scaleAnim }],
                }}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            className="bg-green-600 p-4 rounded-xl shadow-md active:opacity-80"
            onPress={submitReport}
          >
            <Text className="text-white text-center font-semibold text-lg">
              Submit Report
            </Text>
          </TouchableOpacity>
        </View>

        {/* Decorative Glow Circles */}
        <View className="absolute top-10 left-5 w-32 h-32 bg-blue-400/30 rounded-full blur-3xl" />
        <View className="absolute bottom-10 right-5 w-40 h-40 bg-cyan-300/30 rounded-full blur-3xl" />

      </Animated.View>

      <Modal visible={modalVisible} transparent animationType="fade">
        <Pressable
          className="flex-1 bg-black/90 justify-center items-center"
          onPress={() => setModalVisible(false)}
        >
          {image && (
            <Animated.Image
              source={{ uri: image }}
              style={{
                width: "90%",
                height: "70%",
                borderRadius: 16,
                transform: [{ scale: scaleAnim }],
              }}
              resizeMode="contain"
            />
          )}
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}