import React from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { C, FONT } from '../../constants/reportConstants';

interface PhotoPickerProps {
  images: string[];
  onChange: (images: string[]) => void;
}

const PhotoPicker: React.FC<PhotoPickerProps> = ({ images, onChange }) => {
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (!result.canceled) {
      const selected = result.assets.map(a => a.uri);
      onChange([...images, ...selected]);
    }
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  if (images.length > 0) {
    return (
      <View style={styles.imgContainer}>
        {images.map((img, index) => (
          <View key={index} style={styles.imgWrap}>
            <Image source={{ uri: img }} style={styles.imgPreview} />
            <LinearGradient
              colors={['transparent', 'rgba(15,23,42,0.5)']}
              style={styles.imgOverlay}
            />
            <TouchableOpacity style={styles.imgRemove} onPress={() => removeImage(index)}>
              <BlurView intensity={60} tint="light" style={styles.imgRemoveBlur}>
                <Feather name="x" size={14} color={C.text} />
              </BlurView>
            </TouchableOpacity>
            <View style={styles.imgLabel}>
              <Feather name="check-circle" size={13} color={C.white} />
              <Text style={styles.imgLabelText}>Photo attached</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={pickImage} activeOpacity={0.8}>
      <BlurView intensity={55} tint="light" style={styles.uploadBox}>
        <View style={styles.uploadIconCircle}>
          <MaterialCommunityIcons name="camera-plus-outline" size={28} color={C.blueMid} />
        </View>
        <Text style={styles.uploadTitle}>Attach Photos</Text>
        <Text style={styles.uploadSub}>You can upload multiple images</Text>
      </BlurView>
    </TouchableOpacity>
  );
};

export default PhotoPicker;

const styles = StyleSheet.create({
  imgContainer:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imgWrap:         { width: 100, height: 100, borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
  imgPreview:      { width: '100%', height: 200, borderRadius: 22 },
  imgOverlay:      { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  imgRemove:       { position: 'absolute', top: 12, right: 12 },
  imgRemoveBlur:   { width: 34, height: 34, borderRadius: 17, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  imgLabel:        { position: 'absolute', bottom: 12, left: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  imgLabelText:    { color: C.white, fontSize: 12, fontFamily: FONT, fontWeight: '700' },
  uploadBox:       { borderRadius: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(59,130,246,0.30)', overflow: 'hidden', alignItems: 'center', paddingVertical: 38, gap: 8, backgroundColor: C.card },
  uploadIconCircle:{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  uploadTitle:     { color: C.text,    fontSize: 14, fontFamily: FONT, fontWeight: '700' },
  uploadSub:       { color: C.textMid, fontSize: 12, fontFamily: FONT },
});
