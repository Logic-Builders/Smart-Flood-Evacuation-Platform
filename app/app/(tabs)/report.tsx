import { View, Text, TextInput, Button, Image } from "react-native";
import { useState } from "react";
import * as ImagePicker from "expo-image-picker";

export default function Report() {

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [image, setImage] = useState<string | null>(null);

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
  };

  return (

    <View className="flex-1 p-6 bg-white">

      <Text className="text-2xl font-bold mb-6">
        Flood Report
      </Text>

      <TextInput
        placeholder="Name"
        className="border p-3 rounded mb-4"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        placeholder="Phone Number"
        className="border p-3 rounded mb-4"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />

      <TextInput
        placeholder="Affected Area"
        className="border p-3 rounded mb-4"
        value={area}
        onChangeText={setArea}
      />

      <Button title="Upload Photo" onPress={pickImage} />

      {image && (
        <Image
          source={{ uri: image }}
          style={{ width: "100%", height: 160, marginTop: 16, borderRadius: 10 }}
        />
      )}

      <View style={{ marginTop: 20 }}>
        <Button title="Submit Report" onPress={submitReport} />
      </View>

    </View>
  );
}