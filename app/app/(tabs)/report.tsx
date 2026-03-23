import { View, Text, TextInput, TouchableOpacity, Image, Modal, Pressable } from "react-native";
import { useState } from "react";
import * as ImagePicker from "expo-image-picker";

export default function Report() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

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
    alert("Report Submitted Successfully");
    setName("");
    setPhone("");
    setArea("");
    setImage(null);
  };

  return (
    <View className="flex-1 p-6 bg-blue-50">
      <Text className="text-2xl font-bold mb-6 text-center text-blue-900">
        Flood Report
      </Text>

      <TextInput
        placeholder="Name"
        className="border border-gray-300 p-3 rounded mb-4 bg-white"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        placeholder="Phone Number"
        className="border border-gray-300 p-3 rounded mb-4 bg-white"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />

      <TextInput
        placeholder="Affected Area"
        className="border border-gray-300 p-3 rounded mb-4 bg-white"
        value={area}
        onChangeText={setArea}
      />

      <TouchableOpacity
        className="bg-blue-600 p-3 rounded mb-4"
        onPress={pickImage}
      >
        <Text className="text-white text-center font-semibold">Upload Photo</Text>
      </TouchableOpacity>

      {image && (
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Image
            source={{ uri: image }}
            style={{ width: "100%", height: 180, borderRadius: 12, marginBottom: 16 }}
          />
        </TouchableOpacity>
      )}

      <TouchableOpacity
        className="bg-green-600 p-4 rounded"
        onPress={submitReport}
      >
        <Text className="text-white text-center font-semibold text-lg">
          Submit Report
        </Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
      >
        <Pressable
          className="flex-1 bg-black/80 justify-center items-center"
          onPress={() => setModalVisible(false)}
        >
          {image && (
            <Image
              source={{ uri: image }}
              style={{ width: "90%", height: "70%", borderRadius: 12 }}
              resizeMode="contain"
            />
          )}
        </Pressable>
      </Modal>
    </View>
  );
}